# Copyright: (c) OpenSpug Organization. https://github.com/openspug/spug
# Copyright: (c) <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from django.core.cache import cache
from django.conf import settings
from libs.mixins import AdminView, View
from libs import JsonParser, Argument, human_datetime, json_response
from libs.utils import get_request_real_ip, generate_random_str
from libs.spug import send_login_wx_code
from apps.account.models import User, Role, History
from apps.setting.utils import AppSetting
from apps.account.utils import verify_password
from libs.ldap import LDAP
from functools import partial
import user_agents
import ipaddress
import time
import uuid
import json


class UserView(AdminView):
    def get(self, request):
        users = []
        for u in User.objects.filter(deleted_by_id__isnull=True):
            tmp = u.to_dict(excludes=('access_token', 'password_hash'))
            tmp['role_ids'] = [x.id for x in u.roles.all()]
            tmp['password'] = '******'
            users.append(tmp)
        return json_response(users)

    def post(self, request):
        form, error = JsonParser(
            Argument('id', type=int, required=False),
            Argument('username', help='请输入登录名'),
            Argument('password', help='请输入密码'),
            Argument('nickname', help='请输入姓名'),
            Argument('role_ids', type=list, default=[]),
            Argument('wx_token', required=False),
        ).parse(request.body)
        if error is None:
            user = User.objects.filter(username=form.username, deleted_by_id__isnull=True).first()
            if user and (not form.id or form.id != user.id):
                return json_response(error=f'已存在登录名为【{form.username}】的用户')

            role_ids, password = form.pop('role_ids'), form.pop('password')
            if form.id:
                user = User.objects.get(pk=form.id)
                user.update_by_dict(form)
            else:
                if not verify_password(password):
                    return json_response(error='请设置至少8位包含数字、小写和大写字母的新密码')
                user = User.objects.create(
                    password_hash=User.make_password(password),
                    created_by=request.user,
                    **form
                )
            user.roles.set(role_ids)
            user.set_perms_cache()
        return json_response(error=error)

    def patch(self, request):
        form, error = JsonParser(
            Argument('id', type=int, help='参数错误'),
            Argument('password', required=False),
            Argument('is_active', type=bool, required=False),
        ).parse(request.body)
        if error is None:
            user = User.objects.get(pk=form.id)
            if form.password:
                if not verify_password(form.password):
                    return json_response(error='请设置至少8位包含数字、小写和大写字母的新密码')
                user.token_expired = 0
                user.password_hash = User.make_password(form.pop('password'))
            if form.is_active is not None:
                user.is_active = form.is_active
                cache.delete(user.username)
            user.save()
        return json_response(error=error)

    def delete(self, request):
        form, error = JsonParser(
            Argument('id', type=int, help='请指定操作对象')
        ).parse(request.GET)
        if error is None:
            user = User.objects.filter(pk=form.id).first()
            if user:
                if user.type == 'ldap':
                    return json_response(error='ldap账户无法删除，请使用禁用功能来禁止该账户访问系统')
                if user.id == request.user.id:
                    return json_response(error='无法删除当前登录账户')
                user.is_active = True
                user.deleted_at = human_datetime()
                user.deleted_by = request.user
                user.roles.clear()
                user.save()
        return json_response(error=error)


class RoleView(AdminView):
    def get(self, request):
        roles = Role.objects.all()
        return json_response(roles)

    def post(self, request):
        form, error = JsonParser(
            Argument('id', type=int, required=False),
            Argument('name', help='请输入角色名称'),
            Argument('desc', required=False)
        ).parse(request.body)
        if error is None:
            if form.id:
                Role.objects.filter(pk=form.id).update(**form)
            else:
                Role.objects.create(created_by=request.user, **form)
        return json_response(error=error)

    def patch(self, request):
        form, error = JsonParser(
            Argument('id', type=int, help='参数错误'),
            Argument('page_perms', type=dict, required=False),
            Argument('deploy_perms', type=dict, required=False),
            Argument('group_perms', type=list, required=False)
        ).parse(request.body)
        if error is None:
            role = Role.objects.filter(pk=form.pop('id')).first()
            if not role:
                return json_response(error='未找到指定角色')
            if form.page_perms is not None:
                role.page_perms = json.dumps(form.page_perms)
                role.clear_perms_cache()
            if form.deploy_perms is not None:
                role.deploy_perms = json.dumps(form.deploy_perms)
            if form.group_perms is not None:
                role.group_perms = json.dumps(form.group_perms)
            role.user_set.update(token_expired=0)
            role.save()
        return json_response(error=error)

    def delete(self, request):
        form, error = JsonParser(
            Argument('id', type=int, help='参数错误')
        ).parse(request.GET)
        if error is None:
            role = Role.objects.get(pk=form.id)
            if role.user_set.exists():
                return json_response(error='已有用户使用了该角色，请解除关联后再尝试删除')
            role.delete()
        return json_response(error=error)


class SelfView(View):
    def get(self, request):
        data = request.user.to_dict(selects=('nickname', 'wx_token'))
        return json_response(data)

    def patch(self, request):
        form, error = JsonParser(
            Argument('old_password', required=False),
            Argument('new_password', required=False),
            Argument('nickname', required=False, help='请输入昵称'),
            Argument('wx_token', required=False),
        ).parse(request.body)
        if error is None:
            if form.old_password and form.new_password:
                if request.user.type == 'ldap':
                    return json_response(error='LDAP账户无法修改密码')

                if not verify_password(form.new_password):
                    return json_response(error='请设置至少8位包含数字、小写和大写字母的新密码')

                if request.user.verify_password(form.old_password):
                    request.user.password_hash = User.make_password(form.new_password)
                    request.user.token_expired = 0
                    request.user.save()
                    return json_response()
                else:
                    return json_response(error='原密码错误，请重新输入')
            if form.nickname is not None:
                request.user.nickname = form.nickname
            if form.wx_token is not None:
                request.user.wx_token = form.wx_token
            request.user.save()
        return json_response(error=error)


def login(request):
    form, error = JsonParser(
        Argument('username', help='请输入用户名'),
        Argument('password', help='请输入密码'),
        Argument('captcha', required=False),
        Argument('type', required=False)
    ).parse(request.body)
    if error is None:
        handle_response = partial(handle_login_record, request, form.username, form.type)
        user = User.objects.filter(username=form.username, type=form.type).first()
        if user and not user.is_active:
            return handle_response(error="账户已被系统禁用")
        if form.type == 'ldap':
            config = AppSetting.get_default('ldap_service')
            if not config:
                return handle_response(error='请在系统设置中配置LDAP后再尝试通过该方式登录')
            ldap = LDAP(**config)
            is_success, message = ldap.valid_user(form.username, form.password)
            if is_success:
                if not user:
                    user = User.objects.create(username=form.username, nickname=form.username, type=form.type)
                return handle_user_info(handle_response, request, user, form.captcha)
            elif message:
                return handle_response(error=message)
        else:
            if user and user.deleted_by is None:
                if user.verify_password(form.password):
                    return handle_user_info(handle_response, request, user, form.captcha)

        value = cache.get_or_set(form.username, 0, 86400)
        if value >= 3:
            if user and user.is_active:
                user.is_active = False
                user.save()
            return handle_response(error='账户已被系统禁用')
        cache.set(form.username, value + 1, 86400)
        return handle_response(error="用户名或密码错误，连续多次错误账户将会被禁用")
    return json_response(error=error)


def handle_login_record(request, username, login_type, error=None):
    x_real_ip = get_request_real_ip(request.headers)
    user_agent = user_agents.parse(request.headers.get('User-Agent'))
    History.objects.create(
        username=username,
        type=login_type,
        ip=x_real_ip,
        agent=user_agent,
        is_success=False if error else True,
        message=error
    )
    if error:
        return json_response(error=error)


def handle_user_info(handle_response, request, user, captcha):
    cache.delete(user.username)
    key = f'{user.username}:code'
    if captcha:
        code = cache.get(key)
        if not code:
            return handle_response(error='验证码已失效，请重新获取')
        if code != captcha:
            ttl = cache.ttl(key)
            cache.expire(key, ttl - 100)
            return handle_response(error='验证码错误')
        cache.delete(key)
    else:
        mfa = AppSetting.get_default('MFA', {'enable': False})
        if mfa['enable']:
            if not user.wx_token:
                return handle_response(error='已启用登录双重认证，但您的账户未配置微信Token，请联系管理员')
            code = generate_random_str(6)
            send_login_wx_code(user.wx_token, code)
            cache.set(key, code, 300)
            return json_response({'required_mfa': True})

    handle_response()
    x_real_ip = get_request_real_ip(request.headers)
    token_isvalid = user.access_token and len(user.access_token) == 32 and user.token_expired >= time.time()
    user.access_token = user.access_token if token_isvalid else uuid.uuid4().hex
    user.token_expired = time.time() + settings.TOKEN_TTL
    user.last_login = human_datetime()
    user.last_ip = x_real_ip
    user.save()
    verify_ip = AppSetting.get_default('verify_ip', True)
    return json_response({
        'id': user.id,
        'access_token': user.access_token,
        'nickname': user.nickname,
        'is_supper': user.is_supper,
        'has_real_ip': x_real_ip and ipaddress.ip_address(x_real_ip).is_global if verify_ip else True,
        'permissions': [] if user.is_supper else list(user.page_perms)
    })


def logout(request):
    request.user.token_expired = 0
    request.user.save()
    return json_response()
