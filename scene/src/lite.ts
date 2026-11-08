// Phones (device.ts: lite) draw the room with matte Lambert materials instead of physically based ones: same
// textures, colours and glow, a fraction of the work per pixel. A phone's GPU falling behind doesn't just drop
// frames, it stalls the whole page (taps wait for it), so this is what keeps the room responsive there. Metal
// (the round mirror, the lamp's stem) keeps its reflections.
import * as THREE from 'three'
import { lite } from './device'

const made = new Map<THREE.Material, THREE.Material>()

export function cheap<M extends THREE.Material>(m: M): M | THREE.MeshLambertMaterial {
  if (!lite || !(m instanceof THREE.MeshStandardMaterial) || m.metalness > 0.6) return m
  let l = made.get(m) as THREE.MeshLambertMaterial | undefined
  if (!l) {
    l = new THREE.MeshLambertMaterial({
      name: m.name,
      map: m.map,
      color: m.color.clone(),
      emissive: m.emissive.clone(),
      emissiveMap: m.emissiveMap,
      emissiveIntensity: m.emissiveIntensity,
      alphaMap: m.alphaMap,
      alphaTest: m.alphaTest,
      transparent: m.transparent,
      opacity: m.opacity,
      side: m.side,
      depthWrite: m.depthWrite,
      vertexColors: m.vertexColors,
    })
    made.set(m, l)
  }
  return l
}

/** the materials a mesh may have here, for code that adjusts colour and glow */
export type RoomMaterial = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial
