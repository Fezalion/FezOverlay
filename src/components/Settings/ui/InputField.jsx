export default function InputField({ label, type = "text", value, onChange, min, max, step, placeholder, disabled }) {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-300 mb-1">{label}</label>
      {type === "range" ? (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`w-full h-2 rounded-full cursor-pointer
            ${disabled ? "bg-gray-600" : "bg-gradient-to-r from-purple-500 to-pink-500"}
            appearance-none transition-all duration-200`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-3 py-2 rounded-lg bg-gray-800 text-white placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200`}
        />
      )}
      {type === "range" && (
        <span className="text-xs text-gray-400 mt-1">{value}</span>
      )}
    </div>
  );
}
