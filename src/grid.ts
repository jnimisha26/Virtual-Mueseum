export const GRID_SIZE = 12;

export type CellType = 'floor' | 'wall' | 'art';

export interface GridCell {
    x: number;
    y: number;
    type: CellType;
}

export function generateMuseumGrid(): GridCell[][] {
    const grid: GridCell[][] = [];

    // 1. Generate Base Grid and Walls
    for (let y = 0; y < GRID_SIZE; y++) {
        const row: GridCell[] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            // Guarantee outer edges are walls
            const isEdge = x === 0 || y === 0 || x === GRID_SIZE - 1 || y === GRID_SIZE - 1;
            // 10% chance for interior walls to keep the space open
            const isInteriorWall = Math.random() < 0.10;
            const isWall = isEdge || isInteriorWall;
            
            row.push({
                x,
                y,
                type: isWall ? 'wall' : 'floor'
            });
        }
        grid.push(row);
    }

    // 2. Place Artwork in a random floor space
    let artPlaced = false;
    while (!artPlaced) {
        const rx = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1;
        const ry = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1;
        
        // Only place art if the space is currently an empty floor
        if (grid[ry][rx].type === 'floor') {
            grid[ry][rx].type = 'art';
            artPlaced = true;
        }
    }

    return grid;
}