// Real-world contractor names found in public records (for demonstration)
export const contractors = [
    {
        id: 'c1',
        name: 'Nagarjuna Construction Co.',
        rating: 4.2,
        email: 'contact@ncc.in',
        phone: '+91-40-2326-8888',
        zones: ['Main Road', 'Ring Road', 'Highway', 'Expressway'],
        website: 'https://nccltd.com'
    },
    {
        id: 'c2',
        name: 'Eagle Infra India Ltd.',
        rating: 3.8,
        email: 'info@eagleinfra.com',
        phone: '+91-22-2555-0101',
        zones: ['Market', 'City Center', 'Gandhi Nagar', 'Station Road'],
        website: 'http://eagleinfra.com'
    },
    {
        id: 'c3',
        name: 'RPS Infraprojects',
        rating: 2.5,
        email: 'support@rpsinfra.com',
        phone: '+91-22-4001-9999',
        zones: ['Residential', 'Colony', 'Lane', 'Street'],
        website: 'http://rpsinfra.com'
    },
    {
        id: 'c4',
        name: 'Mahaveer Roads & Bridges',
        rating: 3.1,
        email: 'works@mahaveerinfra.in',
        phone: '+91-80-2222-3333',
        zones: ['Industrial Area', 'Tech Park', 'Phase 1', 'Phase 2'],
        website: 'http://mahaveerinfra.in'
    },
    {
        id: 'c5',
        name: 'KNK Construction',
        rating: 4.5,
        email: 'projects@knk.co.in',
        phone: '+91-80-4114-5678',
        zones: ['School Zone', 'Hospital Road', 'University'],
        website: 'http://knk.co.in'
    }
]

// Fallback for unmapped areas
export const defaultContractor = {
    id: 'c0',
    name: 'Municipal Corporation Works Dept',
    rating: 3.0,
    email: 'helpdesk@citymunicipal.gov.in',
    phone: '1800-123-4567',
    zones: [],
    website: 'https://city.gov.in'
}
