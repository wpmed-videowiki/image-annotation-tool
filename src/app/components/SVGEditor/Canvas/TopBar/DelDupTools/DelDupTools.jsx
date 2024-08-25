import React from 'react'
import PropTypes from 'prop-types'

import IconButton from '../../IconButton/IconButton.jsx'

const DelDupTools = ({ canvas, onReset }) => (
  <>
    <IconButton icon="Delete" onClick={() => canvas.deleteSelectedElements()} />
    <IconButton icon="Clone" onClick={() => canvas.cloneSelectedElements(20, 20)} />
    <IconButton
      icon="Reset"
      onClick={onReset}
    />
  </>
)

DelDupTools.propTypes = { canvas: PropTypes.object }
DelDupTools.defaultProps = { canvas: null }

export default DelDupTools
