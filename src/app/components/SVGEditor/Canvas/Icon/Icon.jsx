// General imports
import React from 'react'
import Image from 'next/image'

const group = '/images/icons/group_elements.svg'
const ungroup = '/images/icons/ungroup.svg'
const undo = '/images/icons/undo.svg'
const redo = '/images/icons/redo.svg'
const select = '/images/icons/select.svg'
const line = '/images/icons/line.svg'
const circle = '/images/icons/circle.svg'
const ellipse = '/images/icons/ellipse.svg'
const square = '/images/icons/square.svg'
const rect = '/images/icons/rect.svg'
const save = '/images/icons/save.svg'
const text = '/images/icons/text.svg'
const del = '/images/icons/delete.svg'
const clone = '/images/icons/clone.svg'
const path = '/images/icons/path.svg'
const alignBottom = '/images/icons/align_bottom.svg'
const alignCenter = '/images/icons/align_center.svg'
const alignTop = '/images/icons/align_top.svg'
const alignLeft = '/images/icons/align_left.svg'
const alignRight = '/images/icons/align_right.svg'
const alignMiddle = '/images/icons/align_middle.svg'
const align = '/images/icons/align.svg'
const moveBottom = '/images/icons/move_bottom.svg'
const moveTop = '/images/icons/move_top.svg'
const bold = '/images/icons/bold.svg'
const italic = '/images/icons/italic.svg'
const fill = '/images/icons/fill.svg'
const stroke = '/images/icons/stroke.svg'
const fontSize = '/images/icons/fontsize.svg'
const noColor = '/images/icons/no_color.svg'
const zoom = '/images/icons/zoom.svg'
const close = '/images/icons/close.svg'
const reset = '/images/icons/close.svg'
const arrow = '/images/icons/arrow.svg'
const crop = '/images/icons/scissors.svg'

const Icon = ({ name, ...otherProps }) => {
  switch (name) {
    case 'Select':
      return <Image width={50} height={50}  src={select} alt="select" {...otherProps} />
    case 'Line':
      return <Image width={50} height={50}  src={line} alt="line" {...otherProps} />
    case 'Circle':
      return <Image width={50} height={50}  src={circle} alt="circle" {...otherProps} />
    case 'Ellipse':
      return <Image width={50} height={50}  src={ellipse} alt="ellipse" {...otherProps} />
    case 'Text':
      return <Image width={50} height={50}  src={text} alt="text" {...otherProps} />
    case 'Delete':
      return <Image width={50} height={50}  src={del} alt="delete" {...otherProps} />
    case 'Clone':
      return <Image width={50} height={50}  src={clone} alt="clone" {...otherProps} />
    case 'Path':
      return <Image width={50} height={50}  src={path} alt="path" {...otherProps} />
    case 'Square':
      return <Image width={50} height={50}  src={square} alt="square" {...otherProps} />
    case 'Rect':
      return <Image width={50} height={50}  src={rect} alt="rect" {...otherProps} />
    case 'Close':
      return <Image width={50} height={50}  src={close} alt="close" {...otherProps} />
    case 'Reset':
      return <Image width={50} height={50}  src={reset} alt="reset" {...otherProps} />
    case 'Save':
      return <Image width={50} height={50}  src={save} alt="save" {...otherProps} />
    case 'Undo':
      return <Image width={50} height={50}  src={undo} alt="undo" {...otherProps} />
    case 'Redo':
      return <Image width={50} height={50}  src={redo} alt="redo" {...otherProps} />
    case 'Group':
      return <Image width={50} height={50}  src={group} alt="group" {...otherProps} />
    case 'Ungroup':
      return <Image width={50} height={50}  src={ungroup} alt="group" {...otherProps} />
    case 'AlignBottom':
      return <Image width={50} height={50}  src={alignBottom} alt="group" {...otherProps} />
    case 'AlignCenter':
      return <Image width={50} height={50}  src={alignCenter} alt="group" {...otherProps} />
    case 'AlignTop':
      return <Image width={50} height={50}  src={alignTop} alt="group" {...otherProps} />
    case 'AlignLeft':
      return <Image width={50} height={50}  src={alignLeft} alt="group" {...otherProps} />
    case 'AlignRight':
      return <Image width={50} height={50}  src={alignRight} alt="group" {...otherProps} />
    case 'AlignMiddle':
      return <Image width={50} height={50}  src={alignMiddle} alt="group" {...otherProps} />
    case 'Align':
      return <Image width={50} height={50}  src={align} alt="group" {...otherProps} />
    case 'MoveBottom':
      return <Image width={50} height={50}  src={moveBottom} alt="group" {...otherProps} />
    case 'MoveTop':
      return <Image width={50} height={50}  src={moveTop} alt="group" {...otherProps} />
    case 'Bold':
      return <Image width={50} height={50}  src={bold} alt="group" {...otherProps} />
    case 'Italic':
      return <Image width={50} height={50}  src={italic} alt="group" {...otherProps} />
    case 'Fill':
      return <Image width={50} height={50}  src={fill} alt="group" {...otherProps} />
    case 'Stroke':
      return <Image width={50} height={50}  src={stroke} alt="group" {...otherProps} />
    case 'FontSize':
      return <Image width={50} height={50}  src={fontSize} alt="group" {...otherProps} />
    case 'NoColor':
      return <Image width={50} height={50}  src={noColor} alt="group" {...otherProps} />
    case 'Zoom':
      return <Image width={50} height={50}  src={zoom} alt="group" {...otherProps} />
    case 'Arrow':
      return <Image width={50} height={50}  src={arrow} alt="Arrow" {...otherProps} />
    case 'Crop':
      return <Image width={50} height={50}  src={crop} alt="Crop" {...otherProps} />
    default:
      return <Image width={50} height={50}  src={group} alt="group" {...otherProps} />
  }
}

export default Icon
