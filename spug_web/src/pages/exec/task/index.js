/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { PlusOutlined, ThunderboltOutlined, BulbOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Form, Button, Alert, Radio, Tooltip } from 'antd';
import { ACEditor, AuthDiv, Breadcrumb } from 'components';
import Selector from 'pages/host/Selector';
import TemplateSelector from './TemplateSelector';
import Parameter from './Parameter';
import Output from './Output';
import { http, cleanCommand } from 'libs';
import moment from 'moment';
import store from './store';
import gStore from 'gStore';
import style from './index.module.less';

function TaskIndex() {
  const [loading, setLoading] = useState(false)
  const [interpreter, setInterpreter] = useState('sh')
  const [command, setCommand] = useState('')
  const [template_id, setTemplateId] = useState()
  const [histories, setHistories] = useState([])
  const [parameters, setParameters] = useState([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!loading) {
      http.get('/api/exec/do/')
        .then(res => setHistories(res))
    }
  }, [loading])

  useEffect(() => {
    if (!command) {
      setParameters([])
    }
  }, [command])

  useEffect(() => {
    gStore.fetchUserSettings()
    return () => {
      store.host_ids = []
      if (store.showConsole) {
        store.switchConsole()
      }
    }
  }, [])

  function handleSubmit(params) {
    if (!params && parameters.length > 0) {
      return setVisible(true)
    }
    setLoading(true)
    const formData = {interpreter, template_id, params, host_ids: store.host_ids, command: cleanCommand(command)}
    http.post('/api/exec/do/', formData)
      .then(store.switchConsole)
      .finally(() => setLoading(false))
  }

  function handleTemplate(tpl) {
    if (tpl.host_ids.length > 0) store.host_ids = tpl.host_ids
    setTemplateId(tpl.id)
    setInterpreter(tpl.interpreter)
    setCommand(tpl.body)
    setParameters(tpl.parameters)
  }

  function handleClick(item) {
    setTemplateId(item.template_id)
    setInterpreter(item.interpreter)
    setCommand(item.command)
    setParameters(item.parameters || [])
    store.host_ids = item.host_ids
  }

  return (
    <AuthDiv auth="exec.task.do">
      <Breadcrumb>
        <Breadcrumb.Item>??????</Breadcrumb.Item>
        <Breadcrumb.Item>????????????</Breadcrumb.Item>
        <Breadcrumb.Item>????????????</Breadcrumb.Item>
      </Breadcrumb>
      <div className={style.index} hidden={store.showConsole}>
        <Form layout="vertical" className={style.left}>
          <Form.Item required label="????????????">
            {store.host_ids.length > 0 ? (
              <Alert
                type="info"
                className={style.area}
                message={<div>????????? <b style={{fontSize: 18, color: '#1890ff'}}>{store.host_ids.length}</b> ?????????</div>}
                onClick={() => store.showHost = true}/>
            ) : (
              <Button icon={<PlusOutlined/>} onClick={() => store.showHost = true}>
                ??????????????????
              </Button>
            )}
          </Form.Item>

          <Form.Item required label="????????????" style={{position: 'relative'}}>
            <Radio.Group
              buttonStyle="solid"
              style={{marginBottom: 12}}
              value={interpreter}
              onChange={e => setInterpreter(e.target.value)}>
              <Radio.Button value="sh" style={{width: 80, textAlign: 'center'}}>Shell</Radio.Button>
              <Radio.Button value="python" style={{width: 80, textAlign: 'center'}}>Python</Radio.Button>
            </Radio.Group>
            <a href="https://spug.cc/docs/batch-exec" target="_blank" rel="noopener noreferrer"
               className={style.tips}><BulbOutlined/> ?????????????????????</a>
            <Button style={{float: 'right'}} icon={<PlusOutlined/>} onClick={store.switchTemplate}>????????????????????????</Button>
            <ACEditor className={style.editor} mode={interpreter} value={command} width="100%" onChange={setCommand}/>
          </Form.Item>
          <Button loading={loading} icon={<ThunderboltOutlined/>} type="primary"
                  onClick={() => handleSubmit()}>????????????</Button>
        </Form>

        <div className={style.right}>
          <div className={style.title}>
            ????????????
            <Tooltip title="?????????????????????????????????????????????????????????????????????????????????30????????????">
              <QuestionCircleOutlined style={{color: '#999', marginLeft: 8}}/>
            </Tooltip>
          </div>
          <div className={style.inner}>
            {histories.map((item, index) => (
              <div key={index} className={style.item} onClick={() => handleClick(item)}>
                <div className={style[item.interpreter]}>{item.interpreter.substr(0, 2)}</div>
                <div className={style.number}>{item.host_ids.length}</div>
                {item.template_name ? (
                  <div className={style.tpl}>{item.template_name}</div>
                ) : (
                  <div className={style.command}>{item.command}</div>
                )}
                <div className={style.desc}>{moment(item.updated_at).format('MM.DD HH:mm')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {store.showTemplate && <TemplateSelector onCancel={store.switchTemplate} onOk={handleTemplate}/>}
      {store.showConsole && <Output onBack={store.switchConsole}/>}
      {visible && <Parameter parameters={parameters} onCancel={() => setVisible(false)} onOk={v => handleSubmit(v)}/>}
      <Selector
        visible={store.showHost}
        selectedRowKeys={[...store.host_ids]}
        onCancel={() => store.showHost = false}
        onOk={(_, ids) => store.host_ids = ids}/>

    </AuthDiv>
  )
}

export default observer(TaskIndex)
