import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { gsap } from 'gsap'
import { PLAYER_COLORS } from '../playerColors'
import './CurveGallery.css'

const SCALE = 18
const TOTAL = 200
const CAM_Z = 9
const FOCUS_DIST = 6.5
const MAX_SCALE = 16
const Z_GATE = 11
const LATERAL_OFFSET_RANGE: [number, number] = [-1, 1]
const DEPTH_OFFSET_RANGE: [number, number] = [-0.75, 0.75]
const SIZE_RANGE: [number, number] = [0.28, 0.62]

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function toScaledVector3([x, y, z]: number[], scale: number) {
  return new THREE.Vector3(x * scale, y * scale, z * scale)
}

function buildCurve(raw: number[][]) {
  const points = raw.map((p) => toScaledVector3(p, SCALE))
  return new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5)
}

function getCurveFrame(curve: THREE.CatmullRomCurve3, t: number) {
  const pos = curve.getPoint(t)
  const tangent = curve.getTangent(t)
  return { pos, nx: -tangent.y, ny: tangent.x }
}

function computeFocusScale(distance: number, maxDistance: number, maxScale: number) {
  const f = 1 - distance / maxDistance
  return 1 + f ** 3 * (maxScale - 1)
}

type PlaneUserData = { t: number; photoIndex: number; setScale: (value: number) => void }

function CurveGallery({
  photos,
  onOpenPhoto,
}: {
  photos: string[]
  onOpenPhoto: (src: string) => void
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const onOpenPhotoRef = useRef(onOpenPhoto)
  onOpenPhotoRef.current = onOpenPhoto

  useEffect(() => {
    const wrapper = wrapperRef.current
    const container = containerRef.current
    if (!wrapper || !container || photos.length === 0) return

    let cancelled = false
    let rafId = 0
    let curve: THREE.CatmullRomCurve3 | null = null
    let focusTGate = 0
    const planes: THREE.Mesh[] = []

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const bgColor = new THREE.Color(PLAYER_COLORS[0].bg)
    scene.background = bgColor
    scene.fog = new THREE.Fog(bgColor.getHex(), 10, 40)

    const paletteColors = PLAYER_COLORS.map((c) => new THREE.Color(c.bg))
    function colorForProgress(t: number) {
      const pos = t * paletteColors.length
      const i = Math.floor(pos) % paletteColors.length
      const j = (i + 1) % paletteColors.length
      const frac = pos - Math.floor(pos)
      bgColor.lerpColors(paletteColors[i], paletteColors[j], frac)
      if (scene.fog) (scene.fog as THREE.Fog).color.copy(bgColor)
    }

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      200,
    )

    const textureLoader = new THREE.TextureLoader()
    const textures = photos.map((src) => {
      const texture = textureLoader.load(src)
      texture.colorSpace = THREE.SRGBColorSpace
      return texture
    })

    const camProxy = { t: 0 }
    const setCamT = gsap.quickTo(camProxy, 't', { duration: 1, ease: 'power3.out' })

    function getProgress() {
      if (!wrapper) return 0
      const rect = wrapper.getBoundingClientRect()
      const scrollable = wrapper.offsetHeight - window.innerHeight
      if (scrollable <= 0) return 0
      return Math.min(Math.max(-rect.top / scrollable, 0), 1)
    }

    function onScroll() {
      setCamT(getProgress())
    }

    function onResize() {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      onScroll()
    }

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()

    function onClick(event: MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(planes, false)
      if (hits.length === 0) return
      const { photoIndex } = hits[0].object.userData as PlaneUserData
      const src = photos[photoIndex]
      if (src) onOpenPhotoRef.current(src)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    renderer.domElement.addEventListener('click', onClick)

    function createScaleAnimator(mesh: THREE.Mesh) {
      const proxy = { value: 1 }
      return gsap.quickTo(proxy, 'value', {
        duration: 0.4,
        ease: 'power3.out',
        onUpdate: () => mesh.scale.setScalar(proxy.value),
      })
    }

    async function init() {
      const raw: number[][] = await fetch('/paths/path1.json').then((r) => r.json())
      if (cancelled) return

      curve = buildCurve(raw)
      focusTGate = (FOCUS_DIST * 1.5) / curve.getLength()

      for (let i = 0; i < TOTAL; i++) {
        const t = i / TOTAL
        const { pos, nx, ny } = getCurveFrame(curve, t)
        const lateralOffset = randomBetween(...LATERAL_OFFSET_RANGE)
        const depthOffset = randomBetween(...DEPTH_OFFSET_RANGE)
        const size = randomBetween(...SIZE_RANGE)
        const photoIndex = Math.floor(Math.random() * textures.length)

        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(size, size),
          new THREE.MeshBasicMaterial({ map: textures[photoIndex], side: THREE.DoubleSide }),
        )
        mesh.position.set(
          pos.x + nx * lateralOffset,
          pos.y + ny * lateralOffset,
          pos.z + depthOffset,
        )
        mesh.userData = { t, photoIndex, setScale: createScaleAnimator(mesh) } satisfies PlaneUserData

        planes.push(mesh)
        scene.add(mesh)
      }

      onScroll()

      function animate() {
        rafId = requestAnimationFrame(animate)
        if (!curve) return

        const t = Math.min(Math.max(camProxy.t, 0), 0.999)
        const pathPos = curve.getPoint(t)
        camera.position.set(pathPos.x, pathPos.y, pathPos.z + CAM_Z)
        colorForProgress(t)

        for (const plane of planes) {
          const data = plane.userData as PlaneUserData
          const dx = camera.position.x - plane.position.x
          const dy = camera.position.y - plane.position.y
          const dz = Math.abs(camera.position.z - plane.position.z)
          const distXY = Math.sqrt(dx * dx + dy * dy)

          let dt = Math.abs(data.t - t)
          if (dt > 0.5) dt = 1 - dt

          const isInFocusZone = dt < focusTGate && dz < Z_GATE && distXY < FOCUS_DIST
          const targetScale = isInFocusZone ? computeFocusScale(distXY, FOCUS_DIST, MAX_SCALE) : 1
          data.setScale(targetScale)
        }

        renderer.render(scene, camera)
      }

      animate()
    }

    init()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('click', onClick)
      planes.forEach((mesh) => {
        mesh.geometry.dispose()
        ;(mesh.material as THREE.MeshBasicMaterial).dispose()
      })
      textures.forEach((texture) => texture.dispose())
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [photos])

  return (
    <div className="curve-gallery" ref={wrapperRef}>
      <div className="curve-gallery__sticky">
        <div className="curve-gallery__canvas" ref={containerRef} />
        <p className="curve-gallery__hint">tap a photo ✨</p>
      </div>
    </div>
  )
}

export default CurveGallery
