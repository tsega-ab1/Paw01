import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForceSimulation } from '../../hooks/useForceSimulation.js'
import { useCanvasRenderer }  from '../../hooks/useCanvasRenderer.js'
import { useInteraction }     from '../../hooks/useInteraction.js'

function buildGraph(routine, journey, savedNodes) {
  const nodes = [], edges = []
  if (!routine) return { nodes, edges }

  nodes.push({ id:'root', type:'root', label:(routine.title||'My Goal').slice(0,20), date:routine.startDate, mass:4, pinned:false, vx:0, vy:0, x:0, y:0, parentId:null, metadata:{ goalStatement:routine.goalStatement, totalDays:routine.totalDays } })

  const totalWeeks = Math.min(Math.ceil((routine.totalDays||30)/7), 6)
  for (let w=1; w<=totalWeeks; w++) {
    const d = new Date(routine.startDate||Date.now()); d.setDate(d.getDate()+(w-1)*7)
    const id = `week_${w}`
    nodes.push({ id, type:'week', label:`Wk ${w}`, date:d.toISOString().split('T')[0], mass:2.5, pinned:false, vx:0, vy:0, x:0, y:0, parentId:'root', metadata:{week:w} })
    edges.push(['root', id])
  }

  const types = [...new Set((routine.activities||[]).map(a=>a.type))]
  types.forEach((type,i) => {
    const id = `type_${type}`, weekTarget = `week_${Math.min(i+1,totalWeeks)}`
    nodes.push({ id, type:'activity_type', label:type, date:routine.startDate, mass:1.5, pinned:false, vx:0, vy:0, x:0, y:0, parentId:weekTarget, metadata:{type} })
    edges.push([weekTarget, id])
  })

  ;(journey||[]).slice(-14).forEach((j,i) => {
    const id = `journey_${i}`
    const jDate = j.timestamp?new Date(j.timestamp):new Date()
    const routineStart = new Date(routine.startDate||Date.now())
    const dayNum = Math.max(1,Math.round((jDate-routineStart)/(1000*60*60*24))+1)
    const weekNum = Math.min(Math.ceil(dayNum/7),totalWeeks)
    const parentId = `week_${weekNum}`
    nodes.push({ id, type:'photo', label:(j.caption||j.activity||'').slice(0,16), date:j.timestamp?.split('T')[0], mass:1, pinned:false, vx:0, vy:0, x:0, y:0, parentId, metadata:{photo:j.photo,caption:j.caption,activity:j.activity} })
    edges.push([parentId, id])
  })

  ;(savedNodes||[]).forEach(n => {
    if (nodes.find(x=>x.id===n.id)) return
    nodes.push({ ...n, mass:1.5, pinned:false, vx:n.vx||0, vy:n.vy||0, x:n.x||0, y:n.y||0 })
    if (n.parentId) edges.push([n.parentId, n.id])
  })

  const idx = {}; nodes.forEach((n,i)=>{ idx[n.id]=i })
  const numEdges = edges.map(([a,b])=>[idx[a],idx[b]]).filter(([a,b])=>a!=null&&b!=null)
  return { nodes, edges:numEdges }
}

export default function MindMap({ nodes:savedNodes=[], routine, journey=[], onNodeTap, isDark=true }) {
  const wrapRef      = useRef(null)
  const canvasRef    = useRef(null)
  const nodesRef     = useRef(null)
  const edgesRef     = useRef([])
  const viewRef      = useRef({ zoom:0.85, panX:0, panY:0 })
  const collapsedRef = useRef(new Set())
  const [selectedNode, setSelectedNode] = useState(null)
  const [popup, setPopup] = useState(null)

  const getW = useCallback(()=>wrapRef.current?.clientWidth||360,[])
  const getH = useCallback(()=>wrapRef.current?.clientHeight||420,[])

  // Rebuild graph when data changes
  useEffect(() => {
    const { nodes, edges } = buildGraph(routine, journey, savedNodes)
    if (!nodes.length) { nodesRef.current=[]; edgesRef.current=[]; return }
    const W=getW(), H=getH()
    if (!nodesRef.current || nodesRef.current.length !== nodes.length) {
      nodesRef.current = nodes.map(n=>({ ...n, x:n.x||W/2+(Math.random()-0.5)*220, y:n.y||H/2+(Math.random()-0.5)*220 }))
    }
    edgesRef.current = edges
  }, [routine, journey, savedNodes, getW, getH])

  const { tick, kick } = useForceSimulation({ getW, getH })
  const { render }     = useCanvasRenderer({ canvasRef, viewRef, isDark })

  useEffect(() => {
    function resize() {
      const canvas=canvasRef.current, wrap=wrapRef.current
      if (!canvas||!wrap) return
      const dpr=window.devicePixelRatio||1, W=wrap.clientWidth, H=wrap.clientHeight
      canvas.width=W*dpr; canvas.height=H*dpr
      canvas.style.width=W+'px'; canvas.style.height=H+'px'
      const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr)
      kick(0.3)
    }
    resize()
    window.addEventListener('resize',resize)
    return ()=>window.removeEventListener('resize',resize)
  },[kick])

  useEffect(()=>{
    let raf
    function loop() {
      if (nodesRef.current?.length) {
        tick(nodesRef.current,edgesRef.current,collapsedRef.current)
        render(nodesRef.current,edgesRef.current,collapsedRef.current,selectedNode?.id??null)
      }
      raf=requestAnimationFrame(loop)
    }
    raf=requestAnimationFrame(loop)
    return ()=>cancelAnimationFrame(raf)
  },[tick,render,selectedNode])

  const handleSelect = useCallback((n)=>{
    setSelectedNode(n)
    const dayJourney=(journey||[]).filter(j=>n.date&&j.timestamp?.startsWith(n.date))
    setPopup({node:n,dayJourney})
    onNodeTap?.(n)
  },[journey,onNodeTap])

  const handleDoubleSelect = useCallback((n)=>{
    const s=collapsedRef.current
    if (s.has(n.id)) s.delete(n.id); else s.add(n.id)
    kick(0.2)
  },[kick])

  const { onPointerDown, onPointerMove, onPointerUp } = useInteraction({ canvasRef, nodesRef, viewRef, onSelect:handleSelect, onDoubleSelect:handleDoubleSelect, onKick:kick })

  if (!routine) return (
    <div style={{padding:32,textAlign:'center',color:isDark?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.3)',fontSize:13}}>
      Generate a routine in Chat to grow your map.
    </div>
  )

  return (
    <div ref={wrapRef} style={{ position:'relative', width:'100%', height:420, background:isDark?'#06060e':'#f0f5ec', borderRadius:16, overflow:'hidden', touchAction:'none', userSelect:'none' }}>
      {/* Legend */}
      <div style={{ position:'absolute',top:8,left:10,display:'flex',flexDirection:'column',gap:4,pointerEvents:'none' }}>
        {[{color:'#2d9e55',label:'goal'},{color:'#7F77DD',label:'week'},{color:'#ec4899',label:'moment'},{color:'#06b6d4',label:'event'},{color:'#E24B4A',label:'chaos'}].map(l=>(
          <div key={l.label} style={{display:'flex',alignItems:'center',gap:5}}>
            <div style={{width:5,height:5,borderRadius:'50%',background:l.color,flexShrink:0}}/>
            <span style={{fontSize:8,color:isDark?'rgba(255,255,255,0.28)':'rgba(0,0,0,0.35)',fontFamily:"'DM Mono',monospace",letterSpacing:'0.05em',textTransform:'uppercase'}}>{l.label}</span>
          </div>
        ))}
      </div>
      {/* Hints */}
      <div style={{position:'absolute',top:8,right:10,fontSize:8,color:isDark?'rgba(255,255,255,0.18)':'rgba(0,0,0,0.2)',textAlign:'right',lineHeight:1.9,pointerEvents:'none',fontFamily:"'DM Mono',monospace"}}>
        tap · story<br/>double-tap · collapse<br/>pinch · zoom
      </div>
      <canvas ref={canvasRef} style={{position:'absolute',top:0,left:0,cursor:'grab'}} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}/>
      <AnimatePresence>
        {popup&&<NodePopup popup={popup} isDark={isDark} onClose={()=>{setPopup(null);setSelectedNode(null)}}/>}
      </AnimatePresence>
    </div>
  )
}

function NodePopup({ popup, isDark, onClose }) {
  const { node, dayJourney } = popup
  const bg    = isDark?'rgba(6,6,14,0.97)':'rgba(246,251,242,0.97)'
  const border= isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.1)'
  const text  = isDark?'#e8faf0':'#181d18'
  const muted = isDark?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.45)'
  const ICONS = {root:'🎯',week:'📅',activity_type:'⚡',photo:'📸',event:'⚡',win:'💪',struggle:'😔',decision:'🎯',insight:'💡',dormant:'⚠️',chaos:'💥'}
  return (
    <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:340,damping:34}}
      style={{position:'absolute',bottom:0,left:0,right:0,background:bg,borderTop:`0.5px solid ${border}`,padding:'14px 18px 20px',zIndex:20,backdropFilter:'blur(16px)',maxHeight:'55%',overflowY:'auto'}}>
      <div style={{display:'flex',alignItems:'flex-start',marginBottom:6}}>
        <span style={{fontSize:13,fontWeight:500,color:text,fontFamily:"'DM Mono',monospace"}}>
          {ICONS[node.type]||'●'} {node.label}
        </span>
        <button onClick={onClose} style={{marginLeft:'auto',background:'none',border:'none',color:muted,fontSize:22,lineHeight:1,cursor:'pointer',padding:'0 0 0 12px'}}>×</button>
      </div>
      <div style={{fontSize:9,color:muted,marginBottom:8,letterSpacing:'0.05em',textTransform:'uppercase',fontFamily:"'DM Mono',monospace"}}>
        {node.type} · {node.date||'—'}
      </div>
      {node.metadata?.goalStatement&&<p style={{fontSize:12,color:isDark?'rgba(255,255,255,0.62)':'rgba(0,0,0,0.65)',lineHeight:1.75,marginBottom:10}}>{node.metadata.goalStatement}</p>}
      {node.metadata?.caption&&<p style={{fontSize:12,color:isDark?'rgba(255,255,255,0.62)':'rgba(0,0,0,0.65)',lineHeight:1.75,marginBottom:10}}>{node.metadata.caption}</p>}
      {node.metadata?.photo&&<img src={node.metadata.photo} alt="" style={{width:'100%',borderRadius:10,marginBottom:10,maxHeight:160,objectFit:'cover'}}/>}
      {(dayJourney||[]).map((j,i)=>(
        <div key={i} style={{background:isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)',borderRadius:8,padding:'8px 10px',marginBottom:6}}>
          {j.photo&&<img src={j.photo} alt="" style={{width:'100%',borderRadius:6,marginBottom:5}}/>}
          <p style={{fontSize:12,color:text,lineHeight:1.5,margin:0}}>{j.caption}</p>
        </div>
      ))}
      {node.type==='dormant'&&<div style={{background:'rgba(226,75,74,0.08)',border:'0.5px solid rgba(226,75,74,0.3)',borderRadius:8,padding:'8px 10px',fontSize:11,color:'#F7C1C1'}}>⚠️ This branch went quiet. PAW will suggest ways to reactivate it when search is connected.</div>}
    </motion.div>
  )
}
