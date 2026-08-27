import type {
  Player,
} from '../domain/players'

export const players: Player[] = [
  {
    id: 'demo-01',
    name: 'Marco Portiere',
    team: 'Torino',
    role: 'P',

    iCa: 72,
    pma: 18,
    consensus: 78,
    startingProbability: 96,
    xMv: 6.18,
    xFmv: 5.91,

    penaltyTaker: false,
    status: 'free',
  },

  {
    id: 'demo-02',
    name: 'Luca Difensore',
    team: 'Roma',
    role: 'D',

    iCa: 81,
    pma: 24,
    consensus: 84,
    startingProbability: 91,
    xMv: 6.21,
    xFmv: 6.48,

    penaltyTaker: false,
    status: 'free',
  },

  {
    id: 'demo-03',
    name: 'Andrea Terzino',
    team: 'Milan',
    role: 'D',

    iCa: 67,
    pma: 15,
    consensus: 71,
    startingProbability: 77,
    xMv: 6.04,
    xFmv: 6.31,

    penaltyTaker: false,
    status: 'assigned',
  },

  {
    id: 'demo-04',
    name: 'Paolo Regista',
    team: 'Inter',
    role: 'C',

    iCa: 74,
    pma: 29,
    consensus: 82,
    startingProbability: 88,
    xMv: 6.23,
    xFmv: 6.55,

    penaltyTaker: false,
    status: 'free',
  },

  {
    id: 'demo-05',
    name: 'Davide Mezzala',
    team: 'Atalanta',
    role: 'C',

    iCa: 86,
    pma: 42,
    consensus: 89,
    startingProbability: 93,
    xMv: 6.37,
    xFmv: 7.04,

    penaltyTaker: true,
    status: 'free',
  },

  {
    id: 'demo-06',
    name: 'Fabio Trequartista',
    team: 'Bologna',
    role: 'C',

    iCa: 63,
    pma: 19,
    consensus: 68,
    startingProbability: 73,
    xMv: 6.09,
    xFmv: 6.63,

    penaltyTaker: false,
    status: 'assigned',
  },

  {
    id: 'demo-07',
    name: 'Matteo Punta',
    team: 'Napoli',
    role: 'A',

    iCa: 92,
    pma: 108,
    consensus: 94,
    startingProbability: 97,
    xMv: 6.48,
    xFmv: 8.12,

    penaltyTaker: true,
    status: 'free',
  },

  {
    id: 'demo-08',
    name: 'Simone Attaccante',
    team: 'Lazio',
    role: 'A',

    iCa: 78,
    pma: 61,
    consensus: 80,
    startingProbability: 86,
    xMv: 6.29,
    xFmv: 7.21,

    penaltyTaker: true,
    status: 'assigned',
  },

  {
    id: 'demo-09',
    name: 'Enrico Ala',
    team: 'Fiorentina',
    role: 'A',

    iCa: 70,
    pma: 34,
    consensus: 75,
    startingProbability: 79,
    xMv: 6.14,
    xFmv: 6.81,

    penaltyTaker: false,
    status: 'free',
  },

  {
    id: 'demo-10',
    name: 'Stefano Centrale',
    team: 'Genoa',
    role: 'D',

    iCa: 59,
    pma: 9,
    consensus: 64,
    startingProbability: 82,
    xMv: 5.98,
    xFmv: 6.11,

    penaltyTaker: false,
    status: 'free',
  },
]