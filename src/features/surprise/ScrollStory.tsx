import { Fragment, useState } from 'react'
import CurveGallery from './gallery/CurveGallery'
import PhotoLightbox from './PhotoLightbox'
import RevealLine from './RevealLine'
import LetterReveal from './LetterReveal'
import ScratchReveal from './ScratchReveal'
import MemoryCard from './MemoryCard'
import RememberQuiz from './RememberQuiz'
import type { SurpriseGift } from './useProfile'
import './ScrollStory.css'

const SCROLL_LINES = [
  'hii yetu, hata death haituwezi.',
  'Najua hii pekee haitoshi, so scroll chini kiasi.',
  'your smile and vibes hunijengea siku.',
  'Lets enjoy this moment for now —',
  'still choosing each other.',
]

function ScrollStory({
  herName,
  himName,
  photos,
  himPhotos,
  letter,
  gift,
  memories,
  placesPhotos,
}: {
  herName: string
  himName: string
  photos: string[]
  himPhotos: string[]
  letter: string
  gift: SurpriseGift
  memories: string[]
  placesPhotos: string[]
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const gapCount = SCROLL_LINES.length - 1
  const memoryPhoto = (index: number) =>
    himPhotos.length > 0 ? himPhotos[index % himPhotos.length] : undefined

  return (
    <div className="scroll-story">
      <RememberQuiz photos={placesPhotos} onOpenPhoto={setLightboxSrc} />

      <CurveGallery photos={photos} onOpenPhoto={setLightboxSrc} />

      <div className="scroll-story__lines">
        {SCROLL_LINES.map((line, index) => (
          <Fragment key={line}>
            <RevealLine className="scroll-story__line">
              <p>{line}</p>
            </RevealLine>
            {index < gapCount && memories[index] && (
              <MemoryCard text={memories[index]} photo={memoryPhoto(index)} />
            )}
          </Fragment>
        ))}
        {memories.slice(gapCount).map((memory, extraIndex) => (
          <MemoryCard
            key={`extra-${extraIndex}`}
            text={memory}
            photo={memoryPhoto(gapCount + extraIndex)}
          />
        ))}
      </div>

      <LetterReveal herName={herName} himName={himName} letter={letter} />

      <ScratchReveal himName={himName} gift={gift} />

      {lightboxSrc && <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  )
}

export default ScrollStory
