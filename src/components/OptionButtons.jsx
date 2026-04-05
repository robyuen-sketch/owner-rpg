import './OptionButtons.css'

const OPTION_LABELS = ['A', 'B', 'C', 'D']

function OptionButtons({ options, onSelect, disabled }) {
  return (
    <div className="options-grid">
      {options.map((option, index) => (
        <button
          key={index}
          className="retro-btn option-btn"
          onClick={() => onSelect(index)}
          disabled={disabled}
        >
          <span className="option-label">{OPTION_LABELS[index]}</span>
          <span className="option-text">{option}</span>
        </button>
      ))}
    </div>
  )
}

export default OptionButtons
