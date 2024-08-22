// General imports
import PropTypes from 'prop-types'
import React from 'react'

import Icon from '../Icon/Icon.jsx'

const IconButton = ({ onClick, className = 'button', icon, ...rest }) => (
  <button type="button" className={className} onClick={onClick} {...(rest ? rest : {})} >
    <Icon name={icon} className="OIe-tools-icon" />
    <br />
    {icon}
  </button >
)

export default IconButton
