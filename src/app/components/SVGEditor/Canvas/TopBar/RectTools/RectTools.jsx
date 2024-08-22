import React from 'react'
import PropTypes from 'prop-types'

import AttributesTools from '../AttributesTools/AttributesTools.jsx'

const RectTools = ({ selectedElement }) => (
  <AttributesTools
    selectedElement={selectedElement}
    handleChange={(property, value) => {
      selectedElement.setAttribute(property, value)
      // console.log('handleChange', selectedElement, props)
    }}
    attributes={{
      width: 'text',
      height: 'text',
      // stroke: 'readOnly',
      'stroke-width': 'text',
    }}
  />
)

RectTools.propTypes = { selectedElement: PropTypes.object.isRequired }

export default RectTools
