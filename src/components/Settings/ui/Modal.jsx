export default function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#111118",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "12px",
          padding: "18px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          maxWidth: "min(560px, 92vw)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}
