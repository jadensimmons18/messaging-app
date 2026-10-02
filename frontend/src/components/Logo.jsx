function Logo({ size, className }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 32 32"
            aria-hidden="true"
            className={className}
            style={{ flex: 'none', display: 'block' }}
        >
            <rect width="32" height="32" rx="10" style={{ fill: 'var(--accent)' }} />
            <path
                style={{ fill: 'var(--on-accent)' }}
                d="M8 10.5A3.5 3.5 0 0 1 11.5 7h9A3.5 3.5 0 0 1 24 10.5v6a3.5 3.5 0 0 1-3.5 3.5H15l-4.6 4.2V20A3.5 3.5 0 0 1 8 16.5Z"
            />
            <circle cx="20.5" cy="10.5" r="1.6" style={{ fill: 'var(--accent)' }} />
        </svg>
    )
}

export default Logo
