import './PhotoLightbox.css'

function PhotoLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="photo-lightbox" onClick={onClose}>
      <div className="photo-lightbox__box" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="photo-lightbox__close"
          onClick={onClose}
          aria-label="Close photo"
        >
          ×
        </button>
        <img className="photo-lightbox__img" src={src} alt="A memory of you two" />
      </div>
    </div>
  )
}

export default PhotoLightbox
