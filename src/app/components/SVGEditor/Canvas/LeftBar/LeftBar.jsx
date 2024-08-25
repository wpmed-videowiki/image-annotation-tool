import React from 'react'

import IconButton from '../IconButton/IconButton.jsx'

import { canvasContext } from '../Context/canvasContext.jsx'
import { ARROWS_SHAPES } from '../../extensions/ext-arrows/ext-arrows.js'
import { Menu, MenuItem } from '@mui/material';

const LeftBar = () => {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [canvasState, canvasStateDispatcher] = React.useContext(canvasContext)
  const { mode } = canvasState

  const open = Boolean(anchorEl);
  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
    setMode('arrows')
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  const onArrowTypeClick = (arrowType) => {
    setMode(`arrows-${arrowType}`)
    handleMenuClose()
  }

  const setMode = (newMode) => canvasStateDispatcher({ type: 'mode', mode: newMode })

  return (
    <div className="left-bar">
      <IconButton
        icon="Select"
        className={mode === 'select' ? 'selected' : ''}
        onClick={() => setMode('select')}
      />

      <IconButton
        id="arrows-menu"
        icon="Arrow"
        className={mode.startsWith('arrows') ? 'selected' : ''}
        aria-controls={open ? 'basic-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleMenuClick}
      />
      <Menu
        id="arrows-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        MenuListProps={{
          'aria-labelledby': 'basic-button',
        }}
      >
        {ARROWS_SHAPES.map(shape => (
          <MenuItem onClick={() => onArrowTypeClick(shape.id)} key={`arrow-shape-${shape.id}`}>
            <svg width="50px" height="50px">
              <g className='layer' style={{ transform: 'scale(0.15)' }}>
                <path
                  fill="#FF0000"
                  stroke="#0000"
                  strokeWidth="5"
                  strokeDasharray="null"
                  strokeLinejoin='null'
                  strokeLinecap='null'
                  strokeOpacity='null'
                  d={shape.shape}
                />
              </g>
            </svg>
          </MenuItem>
        ))}
      </Menu>
      <IconButton icon="Text" className={mode === 'text' ? 'selected' : ''} onClick={() => setMode('text')} />
      <IconButton icon="Crop" className={mode === 'crop' ? 'selected' : ''} onClick={() => setMode('crop')} />
      <IconButton
        icon="Ellipse"
        className={mode === 'ellipse' ? 'selected' : ''}
        onClick={() => setMode('ellipse')}
      />
      <IconButton icon="Rect" className={mode === 'rect' ? 'selected' : ''} onClick={() => setMode('rect')} />
      <IconButton icon="Path" className={mode === 'path' ? 'selected' : ''} onClick={() => setMode('path')} />
      <IconButton icon="Line" className={mode === 'line' ? 'selected' : ''} onClick={() => setMode('line')} />
    </div>
  )
}

export default LeftBar
