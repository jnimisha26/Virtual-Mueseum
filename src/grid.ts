export const GRID_SIZE = 12;
export type CellType = 'floor' | 'wall' | 'art';
export type GalleryType = 'classical' | 'modern' | 'maze';

export interface GridCell {
    x: number;
    y: number;
    type: CellType;
}

// 1 = Wall, 0 = Floor, 2 = Art
// Redesigned for wide corridors and a safe 3x3 spawn room at the bottom
const LAYOUTS: Record<GalleryType, number[][]> = {
    classical: [
        [1,1,1,1,1,1,1,1,1,1,1,1],
        [1,2,0,0,0,0,0,0,0,0,2,1],
        [1,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,1,1,0,0,1,1,0,0,1],
        [1,0,0,1,1,0,0,1,1,0,0,1],
        [1,2,0,0,0,0,0,0,0,0,2,1],
        [1,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,1,1,0,0,1,1,0,0,1],
        [1,0,0,1,1,0,0,1,1,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,1],
        [1,1,1,1,1,1,1,1,1,1,1,1],
    ],
    modern: [
        [1,1,1,1,1,1,1,1,1,1,1,1],
        [1,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,2,0,0,0,0,0,0,2,0,1],
        [1,0,0,1,1,0,0,1,1,0,0,1],
        [1,0,0,1,1,0,0,1,1,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,2,2,0,0,0,0,1],
        [1,0,0,1,1,1,1,1,1,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,1],
        [1,1,1,1,1,1,1,1,1,1,1,1],
    ],
    maze: [
        [1,1,1,1,1,1,1,1,1,1,1,1],
        [1,2,0,0,1,0,0,0,0,0,2,1],
        [1,0,0,0,1,0,0,0,0,0,0,1],
        [1,0,0,0,1,0,0,1,1,1,1,1],
        [1,1,1,0,1,0,0,1,2,0,0,1],
        [1,0,0,0,0,0,0,1,0,0,0,1],
        [1,0,0,0,0,0,0,1,0,0,0,1],
        [1,1,1,1,1,0,0,1,1,1,0,1],
        [1,2,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,1],
        [1,1,1,1,1,1,1,1,1,1,1,1],
    ]
};

// Explicit starting points placed dead-center in the large spawn rooms
const ENTRANCES: Record<GalleryType, {x: number, y: number}> = {
    classical: { x: 5, y: 9 },
    modern: { x: 5, y: 9 },
    maze: { x: 5, y: 9 }
};

export function loadMuseumGrid(type: GalleryType = 'classical'): { grid: GridCell[][], start: {x: number, y: number} } {
    const matrix = LAYOUTS[type];
    const grid = matrix.map((row, y) =>
        row.map((val, x) => ({
            x,
            y,
            type: (val === 1 ? 'wall' : val === 2 ? 'art' : 'floor') as CellType
        }))
    );
    return { grid, start: ENTRANCES[type] };
}