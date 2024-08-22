/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
// General imports
import PropTypes from 'prop-types'
import React from 'react'
import colorString from 'color-string'
import { SketchPicker } from 'react-color'
import Icon from '../Icon/Icon.jsx'

const ColorButton = ({ onChange, value, title }) => {
  const [display, setDisplay] = React.useState(false)
  const handleClick = () => setDisplay(!display)
  const onChangeComplete = (color) => {
    onChange(color?.hex)
    setDisplay(false)
  }

  const rgb = colorString.get.rgb(value) || [255, 255, 255] // or white
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {display && rgb && (
        <SketchPicker
          className="OIe-tools-color-panel"
          color={colorString.to.hex(rgb)}
          onChangeComplete={onChangeComplete}
        />
      )}

      <span style={{ display: 'inline-block', marginRight: 5 }}>
        {title} Color
      </span>
      <div
        className="OIe-tools-color-sample"
        onClick={handleClick}
        style={{ backgroundColor: colorString.to.hex(rgb) }}
      />
    </div>
  )
}

// Properties restrictions
ColorButton.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  title: PropTypes.string,
}

ColorButton.defaultProps = { value: '', title: '' }

export default ColorButton
