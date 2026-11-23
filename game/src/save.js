// 3 persistent localStorage save slots storing cash, respect, missions, upgrades, and player position.

const STORAGE_KEY = 'solara_keys_heatline_saves_v1';

export function createDefaultCareer() {
  return {
    cash: 2500,
    respect: 100,
    completedMissions: [],
    upgrades: { armor: 0, turbo: 0 },
    playerPos: { x: 180, z: 18, heading: Math.PI },
    district: 'PALM STRIP',
    updatedAt: null,
  };
}

function readAllRaw() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [null, null, null];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 3) return parsed;
  } catch {
    // Ignore storage access errors in restricted contexts
  }
  return [null, null, null];
}

function writeAllRaw(slots) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
    return true;
  } catch {
    return false;
  }
}

export function listSaveSlots() {
  return readAllRaw();
}

export function saveToSlot(slotIndex, career, completedSet, playerPos, districtName) {
  const slots = readAllRaw();
  const payload = {
    cash: Math.floor(career.cash),
    respect: Math.floor(career.respect),
    completedMissions: [...completedSet],
    upgrades: { armor: career.upgrades.armor || 0, turbo: career.upgrades.turbo || 0 },
    playerPos: { x: Math.round(playerPos.x), z: Math.round(playerPos.z), heading: playerPos.heading || 0 },
    district: districtName || 'PALM STRIP',
    updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
  };
  slots[slotIndex] = payload;
  writeAllRaw(slots);
  return payload;
}

export function loadFromSlot(slotIndex) {
  const slots = readAllRaw();
  const data = slots[slotIndex];
  if (!data) return null;
  return {
    cash: Number(data.cash) || 0,
    respect: Number(data.respect) || 0,
    completedMissions: Array.isArray(data.completedMissions) ? data.completedMissions : [],
    upgrades: {
      armor: Number(data.upgrades?.armor) || 0,
      turbo: Number(data.upgrades?.turbo) || 0,
    },
    playerPos: data.playerPos || { x: 180, z: 18, heading: Math.PI },
    district: data.district || 'PALM STRIP',
    updatedAt: data.updatedAt || null,
  };
}

export function deleteSlot(slotIndex) {
  const slots = readAllRaw();
  slots[slotIndex] = null;
  writeAllRaw(slots);
}
