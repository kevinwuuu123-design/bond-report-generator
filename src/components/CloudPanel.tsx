import { useState } from 'react'
import type { useArchiveStore } from '../hooks/useArchiveStore'

type Store = ReturnType<typeof useArchiveStore>
export default function CloudPanel({ store }: { store:Store }) {
  const [url,setUrl] = useState(store.config?.url || '')
  const [key,setKey] = useState(store.config?.key || '')
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')
  const auth = async (signup:boolean) => {
    if (!store.client) return
    setBusy(true); setMessage('')
    try {
      if (signup) {
        const { data,error } = await store.client.auth.signUp({ email:email.trim(),password, options:{ emailRedirectTo:window.location.origin+window.location.pathname } })
        if(error) throw error
        setMessage(data.session?'注册并登录成功。':'请到邮箱点击确认链接，确认后返回登录。若未收到邮件，请检查垃圾邮件及 Supabase 邮件设置。')
      } else {
        const { error } = await store.client.auth.signInWithPassword({ email:email.trim(),password })
        if(error) throw error
        setMessage('登录成功，正在加载本账号记录。')
      }
      setPassword('')
    } catch(e) { setMessage(e instanceof Error ? e.message : '登录失败，请重试。') }
    finally { setBusy(false) }
  }
  return <details id="cloud-settings" className="dashboard-card settings cloud-settings">
    <summary><div><span className="step-pill muted">云</span><b>手机 / 电脑共用存储</b><span>{store.session?`已登录 · ${store.pending} 笔待确认同步`:store.config?'已配置，等待登录':'未连接云端 · 当前仅本机'}</span></div><i>展开</i></summary>
    <div className="settings-body">
      <p>登录或退出将切换台账并清空当前工作表单，请先归档未完成的内容。</p>
      {store.session ? <>
        <div className="cloud-account"><div><b>{store.session.user.email}</b><p>{store.syncing?'正在同步…':store.lastSynced?`上次同步 ${new Date(store.lastSynced).toLocaleString('zh-CN',{ timeZone:'Asia/Shanghai',hour12:false })}（北京时间）`:'等待首次同步'} · {store.pending} 笔待同步</p></div><button className="secondary" disabled={busy || store.syncing} onClick={async()=>{ if(!store.client)return;setBusy(true);try { const {error}=await store.client.auth.signOut({ scope:'local' });if(error)throw error;setMessage('已退出登录，本机未登录记录另行保留。') }catch(e){setMessage(String(e))}finally{setBusy(false)} }}>退出账号</button></div>
        <div className="archive-actions"><button className="primary" disabled={store.syncing || !store.ready} onClick={()=>void store.sync()}>{store.syncing?'同步中…':'立即同步'}</button><button className="secondary" disabled={!store.ready || store.syncing} onClick={()=>{ try { const count=store.importLocal();setMessage(`已导入 ${count} 笔本机记录（相同编号自动去重）。`);void store.sync() } catch(e){setMessage(String(e))} }}>将本机记录导入账号</button></div>
        <p>手机和电脑使用同一项目地址、同一邮箱账号登录。在线时每 30 秒同步一次，回到页面或恢复联网也会同步。未联网归档的记录先保留在本设备，联网后再上传。</p>
      </> : store.config ? <form className="cloud-login" onSubmit={e=>{ e.preventDefault();void auth(false) }}>
        <p>使用邮箱和密码登录，同一账号在手机和电脑上共享记录。不同账号之间的数据隔离。</p>
        <div className="settings-grid"><label>邮箱<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>密码（至少8位）<input type="password" autoComplete="current-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label></div>
        <div className="archive-actions"><button className="primary" disabled={busy || !store.authReady} type="submit">{busy?'处理中…':'登录并同步'}</button><button className="secondary" disabled={busy || !email || password.length<8} type="button" onClick={()=>void auth(true)}>注册账号</button></div>
      </form> : <p>先按<a href="https://github.com/kevinwuuu123-design/bond-report-generator/blob/main/docs/云端开通指南.md" target="_blank" rel="noreferrer">《云端开通指南》</a>创建 Supabase 项目并运行建表脚本，再在下方填写项目连接信息。也可以通过 GitHub 配置一次，让手机和电脑自动使用同一项目。</p>}
      {!store.session && <details className="connection-config" open={!store.config}><summary>项目连接配置</summary><form onSubmit={e=>{e.preventDefault();try { store.configure({url,key});setMessage('连接配置已保存，请注册或登录账号。') }catch(e){setMessage(e instanceof Error?e.message:String(e))} }}>
        <div className="settings-grid"><label>Supabase 项目地址<input type="url" placeholder="https://xxx.supabase.co" required value={url} onChange={e=>setUrl(e.target.value)}/></label><label>Publishable key / anon 公钥<input required value={key} onChange={e=>setKey(e.target.value)} placeholder="sb_publishable_…" autoComplete="off"/></label></div>
        <p>仅填写可公开的项目公钥，禁止填写 service_role 或 secret 密钥。项目数据的访问权限由账号登录和数据库策略控制。</p><button className="secondary" type="submit">保存连接配置</button>
      </form></details>}
      {message && <p role="status" className="action-message">{message}</p>}
    </div>
  </details>
}
