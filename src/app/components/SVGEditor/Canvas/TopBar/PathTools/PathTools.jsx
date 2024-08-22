import React from 'react'
import PropTypes from 'prop-types'

import AttributesTools from '../AttributesTools/AttributesTools.jsx'

const PathTools = ({ selectedElement }) => (
  <AttributesTools
    selectedElement={selectedElement}
    handleChange={(property, value) => {
      selectedElement.setAttribute(property, value)
    }}
    attributes={{ d: 'readOnly', 'stroke-width': 'text' }}
  />
)

PathTools.propTypes = { selectedElement: PropTypes.object.isRequired }

export default PathTools
