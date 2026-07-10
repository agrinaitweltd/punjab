import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
}

export function Input({ label, ...props }: InputProps) {
  return (
    <label className="form-control">
      <span>{label}</span>
      <input {...props} />
    </label>
  )
}

export function Select({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="form-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

export function TextArea({ label, ...props }: TextareaProps) {
  return (
    <label className="form-control">
      <span>{label}</span>
      <textarea {...props} />
    </label>
  )
}

