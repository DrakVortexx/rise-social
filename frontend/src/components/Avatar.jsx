export function Avatar({ src, name, size = "md" }) {
  const sizeClasses = {
    sm: "avatar-sm",
    md: "avatar-md",
    lg: "avatar-lg",
  };

  const getInitial = (value) => {
    const text = String(value || "").trim();
    return text ? text.charAt(0).toUpperCase() : "?";
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`avatar ${sizeClasses[size]}`}
      />
    );
  }

  return (
    <div className={`avatar ${sizeClasses[size]}`}>
      {getInitial(name)}
    </div>
  );
}
