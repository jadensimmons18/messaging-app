import { avatarColor, initials } from '../helpers/format.js'

function Avatar({ name, size }) {
    return (
        <span
            style={{
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: size,
                height: size,
                borderRadius: '50%',
                background: avatarColor(name),
                color: '#1a1716',
                fontSize: size * 0.36,
                fontWeight: 600,
                letterSpacing: '0.01em',
            }}
        >
            {initials(name)}
        </span>
    )
}

export default Avatar
