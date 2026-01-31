import { contractors, defaultContractor } from '../data/contractors'

/**
 * Find the contractor responsible for a given location address
 * Uses keyword matching against contractor zones
 * @param {string} address - The reported location address
 * @returns {object} Contractor object
 */
export function getContractorByAddress(address) {
    if (!address) return defaultContractor

    const lowerAddress = address.toLowerCase()

    // Find first contractor whose zone keyword appears in the address
    const matchedContractor = contractors.find(contractor =>
        contractor.zones.some(zone => lowerAddress.includes(zone.toLowerCase()))
    )

    return matchedContractor || defaultContractor
}

/**
 * Get aggregated stats for a contractor (simulated)
 * @param {string} contractorId 
 * @returns {object} Stats object
 */
export function getContractorStats(contractorId) {
    // Determine stats based on "random" but consistent hashing of ID for demo purposes
    const idNum = parseInt(contractorId.replace(/\D/g, '')) || 5

    return {
        activePotholes: 10 + (idNum * 3),
        fixedLastMonth: 20 + (idNum * 2),
        avgResponseTime: `${24 + idNum} hours`
    }
}

/**
 * Get all contractors with their current stats
 */
export function getAllContractorsWithStats() {
    return [...contractors, defaultContractor].map(c => ({
        ...c,
        stats: getContractorStats(c.id)
    }))
}
