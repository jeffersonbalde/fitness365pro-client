import React from 'react'
import { parseHmsFieldValue } from '../../utils/workoutDuration'
import './WorkoutMetricsFields.css'

const HMS_PARTS = [
  { name: 'duration_hours', id: 'duration_hours', label: 'Hours', short: 'hr', max: 99, placeholder: '0' },
  { name: 'duration_minutes', id: 'duration_minutes', label: 'Minutes', short: 'min', max: 59, placeholder: '0' },
  { name: 'duration_seconds', id: 'duration_seconds', label: 'Seconds', short: 'sec', max: 59, placeholder: '0' },
]

const WorkoutMetricsFields = ({
  distanceKm,
  durationHours,
  durationMinutes,
  durationSeconds,
  onDistanceChange,
  onDurationPartChange,
  errors = {},
  inputClassName = 'form-control workout-input',
  labelClassName = 'form-label workout-label',
  sectionClassName = 'workout-section',
}) => {
  const handleDurationPartChange = (part) => (event) => {
    const { name, value } = event.target
    const partKey = name === 'duration_hours' ? 'hours' : name === 'duration_minutes' ? 'minutes' : 'seconds'
    onDurationPartChange(name, parseHmsFieldValue(value, partKey))
  }

  const durationError = errors.duration
    || errors.duration_hours
    || errors.duration_minutes
    || errors.duration_seconds

  return (
    <div className={`workout-metrics-block ${sectionClassName}`}>
      <div className="workout-metrics-distance">
        <label htmlFor="distance_km" className={labelClassName}>
          Distance (km) *
        </label>
        <input
          type="number"
          step="0.01"
          className={inputClassName}
          id="distance_km"
          name="distance_km"
          value={distanceKm}
          onChange={onDistanceChange}
          min="0.01"
          required
          placeholder="e.g. 5.00"
          inputMode="decimal"
        />
        {errors.distance_km && (
          <small className="text-danger d-block mt-1">{errors.distance_km}</small>
        )}
      </div>

      <div className="workout-metrics-duration">
        <div className="workout-metrics-duration__heading">
          <span className={labelClassName}>Duration *</span>
          <span className="workout-metrics-duration__hint">Enter hours, minutes, and seconds</span>
        </div>
        <div className="workout-duration-hms" role="group" aria-label="Workout duration">
          {HMS_PARTS.map((part) => (
            <div className="workout-duration-hms__field" key={part.id}>
              <label htmlFor={part.id} className="workout-duration-hms__label">
                {part.label}
              </label>
              <input
                type="number"
                className={`${inputClassName} workout-duration-hms__input`}
                id={part.id}
                name={part.name}
                value={
                  part.name === 'duration_hours'
                    ? durationHours
                    : part.name === 'duration_minutes'
                      ? durationMinutes
                      : durationSeconds
                }
                onChange={handleDurationPartChange(part)}
                min="0"
                max={part.max}
                placeholder={part.placeholder}
                inputMode="numeric"
                aria-label={`Duration ${part.label.toLowerCase()}`}
              />
              <span className="workout-duration-hms__unit">{part.short}</span>
            </div>
          ))}
        </div>
        {durationError && (
          <small className="text-danger d-block mt-1">{durationError}</small>
        )}
      </div>
    </div>
  )
}

export default WorkoutMetricsFields
