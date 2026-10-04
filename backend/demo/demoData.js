// What every new demo account starts with: some fake people ("personas") and the conversations
// the visitor already has with them. `minutesAgo` is relative to the moment the demo is created,
// so the list always looks fresh: some chats from minutes ago, some "Yesterday", some earlier this week.
// Messages must be listed oldest -> newest (largest minutesAgo first).

export const PERSONAS = [
    'maya_torres',
    'dev_patel',
    'sam_okafor',
    'priya_nair',
    'leo_chen',
    'alex_rivera',
];

export const SCENARIOS = [
    {
        persona: 'maya_torres',
        status: 'accepted',
        messages: [
            { from: 'them', text: 'Are we still on for dinner tonight?', minutesAgo: 95 },
            { from: 'them', text: 'I found that ramen place on 5th everyone keeps talking about', minutesAgo: 94 },
            { from: 'me', text: "Yes! I've been wanting to try it", minutesAgo: 80 },
            { from: 'me', text: 'What time works for you?', minutesAgo: 79 },
            { from: 'them', text: "7? They don't take reservations so earlier is better", minutesAgo: 40 },
            { from: 'me', text: "7 works. I'll grab a table if I get there first", minutesAgo: 30 },
            { from: 'them', text: 'Perfect, see you at 7 then', minutesAgo: 12 },
        ],
    },
    {
        // a stranger who messaged first: shows up under "Unknown" with the Accept / Reject banner
        persona: 'alex_rivera',
        status: 'pending',
        messages: [
            { from: 'them', text: 'Hey! We met at the meetup last week, hope it’s okay to message you.', minutesAgo: 50 },
            { from: 'them', text: 'Would love to hear more about what you’re building.', minutesAgo: 45 },
        ],
    },
    {
        persona: 'dev_patel',
        status: 'accepted',
        messages: [
            { from: 'them', text: 'did you catch the game last night?', minutesAgo: 1560 },
            { from: 'me', text: 'barely, I fell asleep in the third quarter', minutesAgo: 1550 },
            { from: 'them', text: "you didn't miss much honestly", minutesAgo: 1545 },
            { from: 'me', text: "lol that's exactly what I said", minutesAgo: 1500 },
        ],
    },
    {
        persona: 'leo_chen',
        status: 'accepted',
        messages: [
            { from: 'them', text: 'Are you free to sync on Thursday?', minutesAgo: 2950 },
            { from: 'me', text: 'sounds good, talk then', minutesAgo: 2900 },
        ],
    },
    {
        persona: 'sam_okafor',
        status: 'accepted',
        messages: [
            { from: 'them', text: "Boat's back in the water this weekend", minutesAgo: 4400 },
            { from: 'them', text: 'You should come out if the weather holds', minutesAgo: 4399 },
        ],
    },
    {
        persona: 'priya_nair',
        status: 'accepted',
        messages: [
            { from: 'me', text: 'Thanks again for the recommendation!', minutesAgo: 8700 },
            { from: 'them', text: 'Anytime! Let me know how it goes.', minutesAgo: 8690 },
        ],
    },
];
