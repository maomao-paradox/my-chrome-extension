// MASwitch.tsx
import React, { useState, useEffect, useRef } from 'react'
import './MASwitch.css'

// 定义 Props 类型
interface MASwitchProps {
  checked?: boolean
  defaultChecked?: boolean
  label?: string
  openText?: string
  closeText?: string
  onChange?: (checked: boolean) => void
  className?: string
  disabled?: boolean
}

const MASwitch: React.FC<MASwitchProps> = ({
  checked: controlledChecked,
  defaultChecked = false,
  label = '',
  openText = '启用',
  closeText = '禁用',
  onChange,
  className = '',
  disabled = false
}) => {
  // 判断是否为受控组件
  const isControlled = controlledChecked !== undefined
  
  // 内部状态（非受控模式）
  const [internalChecked, setInternalChecked] = useState(defaultChecked)
  
  // 实际使用的 checked 值
  const checked = isControlled ? controlledChecked : internalChecked
  
  // 处理点击事件
  const handleClick = () => {
    if (disabled) return
    
    const newChecked = !checked
    
    // 非受控模式下更新内部状态
    if (!isControlled) {
      setInternalChecked(newChecked)
    }
    
    // 触发 onChange 回调
    onChange?.(newChecked)
  }
  
  // 键盘事件支持
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }
  
  return (
    <div className={`sci-fi-switch-container ${className}`}>
      {label && <div className="sci-fi-switch-label">{label}</div>}
      <div
        className={`sci-fi-switch ${checked ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <div className="switch-track">
          <div className="switch-thumb" />
          <div className="switch-glow" />
          <div className="switch-indicator">
            {checked ? openText : closeText}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MASwitch