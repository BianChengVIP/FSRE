/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState } from 'react';
import { observer } from 'mobx-react';
import { Modal, Form, Input, Transfer, message } from 'antd';
import http from 'libs/http';
import store from './store';
import contactStore from '../contact/store';

export default observer(function () {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  function handleSubmit() {
    setLoading(true);
    const formData = form.getFieldsValue();
    formData['id'] = store.record.id;
    http.post('/api/alarm/group/', formData)
      .then(res => {
        message.success('操作成功');
        store.formVisible = false;
        store.fetchRecords()
      }, () => setLoading(true))
  }

  return (
    <Modal
      visible
      width={800}
      maskClosable={false}
      title={store.record.id ? '编辑联系组' : '新建联系组'}
      onCancel={() => store.formVisible = false}
      confirmLoading={loading}
      onOk={handleSubmit}>
      <Form form={form} initialValues={store.record} labelCol={{span: 6}} wrapperCol={{span: 14}}>
        <Form.Item required name="name" label="组名称">
          <Input placeholder="请输入联系组名称"/>
        </Form.Item>
        <Form.Item name="desc" label="备注信息">
          <Input.TextArea placeholder="请输入模板备注信息"/>
        </Form.Item>
        <Form.Item required name="contacts" valuePropName="targetKeys" label="选择联系人">
          <Transfer
            rowKey={item => item.id}
            titles={['已有联系人', '已选联系人']}
            listStyle={{width: 199}}
            dataSource={contactStore.records}
            render={item => item.name}/>
        </Form.Item>
      </Form>
    </Modal>
  )
})