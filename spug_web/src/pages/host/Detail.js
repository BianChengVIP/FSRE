/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react';
import { Drawer, Descriptions, List, Button, Input, Select, DatePicker, Tag, message } from 'antd';
import { EditOutlined, SaveOutlined, PlusOutlined, SyncOutlined } from '@ant-design/icons';
import { AuthButton } from 'components';
import { http } from 'libs';
import store from './store';
import lds from 'lodash';
import moment from 'moment';
import styles from './index.module.less';

export default observer(function () {
  const [edit, setEdit] = useState(false);
  const [host, setHost] = useState(store.record);
  const diskInput = useRef();
  const sipInput = useRef();
  const gipInput = useRef();
  const [tag, setTag] = useState();
  const [inputVisible, setInputVisible] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (store.detailVisible) {
      setHost(lds.cloneDeep(store.record))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.detailVisible])

  useEffect(() => {
    if (inputVisible === 'disk') {
      diskInput.current.focus()
    } else if (inputVisible === 'sip') {
      sipInput.current.focus()
    } else if (inputVisible === 'gip') {
      gipInput.current.focus()
    }
  }, [inputVisible])

  function handleSubmit() {
    setLoading(true)
    if (host.created_time) host.created_time = moment(host.created_time).format('YYYY-MM-DD')
    if (host.expired_time) host.expired_time = moment(host.expired_time).format('YYYY-MM-DD')
    http.post('/api/host/extend/', {host_id: host.id, ...host})
      .then(res => {
        Object.assign(host, res);
        setEdit(false);
        setHost(lds.cloneDeep(host));
        store.fetchRecords()
      })
      .finally(() => setLoading(false))
  }

  function handleFetch() {
    setFetching(true);
    http.get('/api/host/extend/', {params: {host_id: host.id}})
      .then(res => {
        Object.assign(host, res);
        setHost(lds.cloneDeep(host));
        message.success('????????????')
      })
      .finally(() => setFetching(false))
  }

  function handleChange(e, key) {
    host[key] = e && e.target ? e.target.value : e;
    if (['created_time', 'expired_time'].includes(key) && e) {
      host[key] = e.format('YYYY-MM-DD')
    }
    setHost({...host})
  }

  function handleClose() {
    store.detailVisible = false;
    setEdit(false)
  }

  function handleTagConfirm(key) {
    if (tag) {
      if (key === 'disk') {
        const value = Number(tag);
        if (lds.isNaN(value)) return message.error('???????????????');
        host.disk ? host.disk.push(value) : host.disk = [value]
      } else if (key === 'sip') {
        host.private_ip_address ? host.private_ip_address.push(tag) : host.private_ip_address = [tag]
      } else if (key === 'gip') {
        host.public_ip_address ? host.public_ip_address.push(tag) : host.public_ip_address = [tag]
      }
      setHost(lds.cloneDeep(host))
    }
    setTag(undefined);
    setInputVisible(false)
  }

  function handleTagRemove(key, index) {
    if (key === 'disk') {
      host.disk.splice(index, 1)
    } else if (key === 'sip') {
      host.private_ip_address.splice(index, 1)
    } else if (key === 'gip') {
      host.public_ip_address.splice(index, 1)
    }
    setHost(lds.cloneDeep(host))
  }

  return (
    <Drawer
      width={550}
      title={host.name}
      placement="right"
      onClose={handleClose}
      visible={store.detailVisible}>
      <Descriptions
        bordered
        size="small"
        labelStyle={{width: 150}}
        title={<span style={{fontWeight: 500}}>????????????</span>}
        column={1}>
        <Descriptions.Item label="????????????">{host.name}</Descriptions.Item>
        <Descriptions.Item label="????????????">{host.username}@{host.hostname}</Descriptions.Item>
        <Descriptions.Item label="????????????">{host.port}</Descriptions.Item>
        <Descriptions.Item label="????????????">{host.pkey ? '???' : '???'}</Descriptions.Item>
        <Descriptions.Item label="????????????">{host.desc}</Descriptions.Item>
        <Descriptions.Item label="????????????">
          <List>
            {lds.get(host, 'group_ids', []).map(g_id => (
              <List.Item key={g_id} style={{padding: '6px 0'}}>{store.groups[g_id]}</List.Item>
            ))}
          </List>
        </Descriptions.Item>
      </Descriptions>
      <Descriptions
        bordered
        size="small"
        column={1}
        className={edit ? styles.hostExtendEdit : null}
        labelStyle={{width: 150}}
        style={{marginTop: 24}}
        extra={edit ? ([
          <Button key="1" type="link" loading={fetching} icon={<SyncOutlined/>} onClick={handleFetch}>??????</Button>,
          <Button key="2" type="link" loading={loading} icon={<SaveOutlined/>} onClick={handleSubmit}>??????</Button>
        ]) : (
          <AuthButton auth="host.host.edit" type="link" icon={<EditOutlined/>} onClick={() => setEdit(true)}>??????</AuthButton>
        )}
        title={<span style={{fontWeight: 500}}>????????????</span>}>
        <Descriptions.Item label="??????ID">
          {edit ? (
            <Input value={host.instance_id} onChange={e => handleChange(e, 'instance_id')} placeholder="??????"/>
          ) : host.instance_id}
        </Descriptions.Item>
        <Descriptions.Item label="????????????">
          {edit ? (
            <Input value={host.os_name} onChange={e => handleChange(e, 'os_name')}
                   placeholder="?????????Ubuntu Server 16.04.1 LTS"/>
          ) : host.os_name}
        </Descriptions.Item>
        <Descriptions.Item label="CPU">
          {edit ? (
            <Input suffix="???" style={{width: 100}} value={host.cpu} onChange={e => handleChange(e, 'cpu')}
                   placeholder="??????"/>
          ) : host.cpu ? `${host.cpu}???` : null}
        </Descriptions.Item>
        <Descriptions.Item label="??????">
          {edit ? (
            <Input suffix="GB" style={{width: 100}} value={host.memory} onChange={e => handleChange(e, 'memory')}
                   placeholder="??????"/>
          ) : host.memory ? `${host.memory}GB` : null}
        </Descriptions.Item>
        <Descriptions.Item label="??????">
          {lds.get(host, 'disk', []).map((item, index) => (
            <Tag visible closable={edit} key={index} onClose={() => handleTagRemove('disk', index)}>{item}GB</Tag>
          ))}
          {edit && (inputVisible === 'disk' ? (
            <Input
              ref={diskInput}
              type="text"
              size="small"
              value={tag}
              className={styles.tagNumberInput}
              onChange={e => setTag(e.target.value)}
              onBlur={() => handleTagConfirm('disk')}
              onPressEnter={() => handleTagConfirm('disk')}
            />
          ) : (
            <Tag className={styles.tagAdd} onClick={() => setInputVisible('disk')}><PlusOutlined/> ??????</Tag>
          ))}
        </Descriptions.Item>
        <Descriptions.Item label="??????IP">
          {lds.get(host, 'private_ip_address', []).map((item, index) => (
            <Tag visible closable={edit} key={index} onClose={() => handleTagRemove('sip', index)}>{item}</Tag>
          ))}
          {edit && (inputVisible === 'sip' ? (
            <Input
              ref={sipInput}
              type="text"
              size="small"
              value={tag}
              className={styles.tagInput}
              onChange={e => setTag(e.target.value)}
              onBlur={() => handleTagConfirm('sip')}
              onPressEnter={() => handleTagConfirm('sip')}
            />
          ) : (
            <Tag className={styles.tagAdd} onClick={() => setInputVisible('sip')}><PlusOutlined/> ??????</Tag>
          ))}
        </Descriptions.Item>
        <Descriptions.Item label="??????IP">
          {lds.get(host, 'public_ip_address', []).map((item, index) => (
            <Tag visible closable={edit} key={index} onClose={() => handleTagRemove('gip', index)}>{item}</Tag>
          ))}
          {edit && (inputVisible === 'gip' ? (
            <Input
              ref={gipInput}
              type="text"
              size="small"
              value={tag}
              className={styles.tagInput}
              onChange={e => setTag(e.target.value)}
              onBlur={() => handleTagConfirm('gip')}
              onPressEnter={() => handleTagConfirm('gip')}
            />
          ) : (
            <Tag className={styles.tagAdd} onClick={() => setInputVisible('gip')}><PlusOutlined/> ??????</Tag>
          ))}
        </Descriptions.Item>
        <Descriptions.Item label="??????????????????">
          {edit ? (
            <Select
              style={{width: 150}}
              value={host.instance_charge_type}
              placeholder="?????????"
              onChange={v => handleChange(v, 'instance_charge_type')}>
              <Select.Option value="PrePaid">????????????</Select.Option>
              <Select.Option value="PostPaid">????????????</Select.Option>
              <Select.Option value="Other">??????</Select.Option>
            </Select>
          ) : host.instance_charge_type_alias}
        </Descriptions.Item>
        <Descriptions.Item label="??????????????????">
          {edit ? (
            <Select
              style={{width: 150}}
              value={host.internet_charge_type}
              placeholder="?????????"
              onChange={v => handleChange(v, 'internet_charge_type')}>
              <Select.Option value="PayByBandwidth">???????????????</Select.Option>
              <Select.Option value="PayByTraffic">???????????????</Select.Option>
              <Select.Option value="Other">??????</Select.Option>
            </Select>
          ) : host.internet_charge_type_alisa}
        </Descriptions.Item>
        <Descriptions.Item label="????????????">
          {edit ? (
            <DatePicker
              value={host.created_time ? moment(host.created_time) : undefined}
              onChange={v => handleChange(v, 'created_time')}/>
          ) : host.created_time}
        </Descriptions.Item>
        <Descriptions.Item label="????????????">
          {edit ? (
            <DatePicker
              value={host.expired_time ? moment(host.expired_time) : undefined}
              onChange={v => handleChange(v, 'expired_time')}/>
          ) : host.expired_time}
        </Descriptions.Item>
        <Descriptions.Item label="????????????">{host.updated_at}</Descriptions.Item>
      </Descriptions>
    </Drawer>
  )
})