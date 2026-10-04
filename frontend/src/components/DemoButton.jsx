// The "or" divider plus the outlined "Try the demo" button, placed under a form's main button.
function DemoButton({ loading, onClick }) {
    return (
        <>
            <div className="login__or" aria-hidden="true">
                <span />
                or
                <span />
            </div>

            <button type="button" className="login__secondary" disabled={loading} onClick={onClick}>
                {loading ? (
                    'Setting up your demo…'
                ) : (
                    <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M8 5.5v13l11-6.5z" />
                        </svg>
                        Try the demo
                    </>
                )}
            </button>
        </>
    )
}

export default DemoButton
