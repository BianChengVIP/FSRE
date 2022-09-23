import React, { useState } from 'react';
import { observer } from 'mobx-react';
import { Form, Input, Select, Modal, Button, Radio } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { LinkButton, ACEditor } from 'components';
import TemplateSelector from '../exec/task/TemplateSelector';
import { cleanCommand } from 'libs';
import store from './store';

export default observer(function () {
  const [form] = Form.useForm();
  const [showTmp, setShowTmp] = useState(false);
  const [command, setCommand] = useState(store.record.command || '');

  function handleAddZone() {
    let type;
    Modal.confirm({
      icon: <ExclamationCircleOutlined/>,
      title: '添加任务类型',
      content: (
        <Form layout="vertical" style={{marginTop: 24}}>
          <Form.Item required label="任务类型">
            <Input onChange={e => type = e.target.value}/>
          </Form.Item>
        </Form>
      ),
      onOk: () => {
        if (type) {
          store.types.push(type);
          form.setFieldsValue({type})
        }
      },
    })
  }

  function canNext() {
    const formData = form.getFieldsValue()
    return !(formData.type && formData.name && command)
  }

  function handleNext() {
    store.page += 1;
    Object.assign(store.record, form.getFieldsValue(), {command: cleanCommand(command)})
  }

  function handleSelect(tpl) {
    const {interpreter, body} = tpl;
    setCommand(body)
    form.setFieldsValue({interpreter})
  }

  let modePlaceholder;
  switch (store.record.rst_notify.mode) {
    case '0':
      modePlaceholder = '已关闭'
      break
    case '1':
      modePlaceholder = 'https://oapi.dingtalk.com/robot/send?access_token=xxx'
      break
    case '3':
      modePlaceholder = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx'
      break
    case '4':
      modePlaceholder = 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx'
      break
    default:
      modePlaceholder = '请输入'
  }

  return (
    <Form form={form} initialValues={store.record} labelCol={{span: 6}} wrapperCol={{span: 14}}>
      <Form.Item required label="任务类型" style={{marginBottom: 0}}>
        <Form.Item name="type" style={{display: 'inline-block', width: '80%'}}>
          <Select placeholder="请选择任务类型">
            {store.types.map(item => (
              <Select.Option value={item} key={item}>{item}</Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item style={{display: 'inline-block', width: '20%', textAlign: 'right'}}>
          <Button type="link" onClick={handleAddZone}>添加类型</Button>
        </Form.Item>
      </Form.Item>
      <Form.Item required name="name" label="任务名称">
        <Input placeholder="请输入任务名称"/>
      </Form.Item>
      <Form.Item required label="任务内容" extra={<LinkButton onClick={() => setShowTmp(true)}>从模板添加</LinkButton>}>
        <Form.Item noStyle name="interpreter">
          <Radio.Group buttonStyle="solid" style={{marginBottom: 12}}>
            <Radio.Button value="sh" style={{width: 80, textAlign: 'center'}}>Shell</Radio.Button>
            <Radio.Button value="python" style={{width: 80, textAlign: 'center'}}>Python</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item noStyle shouldUpdate>
          {({getFieldValue}) => (
            <ACEditor mode={getFieldValue('interpreter')} value={command} width="100%" height="150px"
                      onChange={setCommand}/>
          )}
        </Form.Item>
      </Form.Item>
      <Form.Item label="失败通知" extra={(
        <span>
            任务执行失败告警通知，
            <a target="_blank" rel="noopener noreferrer"
               href="https://spug.cc/docs/use-problem#use-dd">钉钉收不到通知？</a>
          </span>)}>
        <Input
          value={store.record.rst_notify.value}
          onChange={e => store.record.rst_notify.value = e.target.value}
          addonBefore={(
            <Select style={{width: 100}} value={store.record.rst_notify.mode}
                    onChange={v => store.record.rst_notify.mode = v}>
              <Select.Option value="0">关闭</Select.Option>
              <Select.Option value="1">钉钉</Select.Option>
              <Select.Option value="4">飞书</Select.Option>
              <Select.Option value="3">企业微信</Select.Option>
              <Select.Option value="2">Webhook</Select.Option>
            </Select>
          )}
          disabled={store.record.rst_notify.mode === '0'}
          placeholder={modePlaceholder}/>
      </Form.Item>
      <Form.Item name="desc" label="备注信息">
        <Input.TextArea placeholder="请输入模板备注信息"/>
      </Form.Item>
      <Form.Item shouldUpdate wrapperCol={{span: 14, offset: 6}}>
        {() => <Button disabled={canNext()} type="primary" onClick={handleNext}>下一步</Button>}
      </Form.Item>
      {showTmp && <TemplateSelector onOk={handleSelect} onCancel={() => setShowTmp(false)}/>}
    </Form>
  )
})