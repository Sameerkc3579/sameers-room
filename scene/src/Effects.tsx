// Loaded on demand (React.lazy): only GPUs with headroom ever download the post-processing code.
import { EffectComposer, N8AO, Bloom, ToneMapping, Noise, SMAA } from '@react-three/postprocessing'
import { ToneMappingMode, BlendFunction } from 'postprocessing'
import { useScene } from './store'

const FX = new URLSearchParams(location.search).get('fx') // debug: ?fx=ao,bloom,smaa,grain forces effects on
const on = (k: string) => FX === null || FX.split(',').includes(k)

/**
 * Extra polish for GPUs with headroom (picked by <PerformanceMonitor/>): live ambient occlusion, glow on bright
 * things, film grain, SMAA. On the normal tier the renderer's own tone mapping and a CSS vignette stand in.
 */
export default function Effects() {
  const view = useScene((s) => s.view)
  const high = useScene((s) => s.quality === 'high')
  if (!(FX || high) || view !== 'room') return null
  return (
    <EffectComposer multisampling={0}>
      {on('ao') ? <N8AO aoRadius={0.35} distanceFalloff={0.6} intensity={2} quality="low" halfRes /> : <></>}
      {on('bloom') ? <Bloom luminanceThreshold={0.85} luminanceSmoothing={0.3} intensity={0.35} mipmapBlur /> : <></>}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      {on('grain') ? <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.12} /> : <></>}
      {on('smaa') ? <SMAA /> : <></>}
    </EffectComposer>
  )
}
