const AVATAR_COLORS = ['#EDB6A1', '#A3C8DE', '#E8D193', '#A9CBB6', '#DFAEC6', '#BDB6E6']

// "maya_torres" -> "MT", "jaden" -> "JA"
export function initials(name = '') {
    const parts = name.split(/[\s_.-]+/).filter(Boolean)
    const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)
    return letters.toUpperCase()
}

// same name always gets the same color
export function avatarColor(name = '') {
    let hash = 0
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
    return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

// today -> "9:41 PM", yesterday -> "Yesterday", this week -> "Tue", older -> "Oct 2"
export function timeLabel(dateString) {
    const date = new Date(dateString)
    const now = new Date()
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / 86400000)

    if (daysAgo <= 0) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    if (daysAgo === 1) return 'Yesterday'
    if (daysAgo < 7) return date.toLocaleDateString([], { weekday: 'short' })
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// "Today", "Yesterday", "Tue" or "Oct 2" — the day part of a chat time divider
export function dayLabel(dateString) {
    const date = new Date(dateString)
    const now = new Date()
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / 86400000)

    if (daysAgo <= 0) return 'Today'
    if (daysAgo === 1) return 'Yesterday'
    if (daysAgo < 7) return date.toLocaleDateString([], { weekday: 'long' })
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// "9:41 PM"
export function clockTime(dateString) {
    return new Date(dateString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
