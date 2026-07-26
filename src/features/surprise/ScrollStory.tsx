import { Fragment, useState } from 'react'
import CurveGallery from './gallery/CurveGallery'
import PhotoLightbox from './PhotoLightbox'
import RevealLine from './RevealLine'
import LetterReveal from './LetterReveal'
import ScratchReveal from './ScratchReveal'
import MemoryCard from './MemoryCard'
import RememberQuiz from './RememberQuiz'
import type { SurpriseGift, SurpriseMemory } from './useProfile'
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
  letter,
  gift,
  memories,
  placesPhotos,
  premium = false,
}: {
  herName: string
  himName: string
  photos: string[]
  letter: string
  gift: SurpriseGift
  memories: SurpriseMemory[]
  placesPhotos: string[]
  premium?: boolean
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const gapCount = SCROLL_LINES.length - 1

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
              <MemoryCard
                prompt={memories[index].prompt}
                photo={memories[index].photo}
                caption={memories[index].caption}
              />
            )}
          </Fragment>
        ))}
        {memories.slice(gapCount).map((memory, extraIndex) => (
          <MemoryCard
            key={`extra-${extraIndex}`}
            prompt={memory.prompt}
            photo={memory.photo}
            caption={memory.caption}
          />
        ))}
      </div>

      <LetterReveal herName={herName} himName={himName} letter={letter} />

      <ScratchReveal himName={himName} gift={gift} premium={premium} />

      {lightboxSrc && <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  )
}

export default ScrollStory
