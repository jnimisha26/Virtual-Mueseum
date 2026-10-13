🏛️ **Virtual WebGL Museum & AI Navigation Gallery**

An immersive, 3D web-based museum gallery built with **Three.js, Vite, and Pathfinding.js**. This project features multiple architectural gallery layouts, dynamic framed artwork rendering from local textures, first-person collision controls, a real-time minimap, and an autonomous human NPC utilizing A star pathfinding.

🚀 **Live Demo**

Playable Web Build: (https://virtual-mueseum-theta.vercel.app/)


✨ **Key Features**

1. Multiple Architectural Layouts: Select between Classical, Modern, and Maze gallery configurations upon entry.
2. Dynamic Framed Art Display: Automatically scans the src/textures/ folder, calculates aspect ratios, and flush-mounts framed canvases with proper spacing onto every exposed wall block.
3. First-Person Visitor Controls: Navigate the museum using Arrow keys with robust THREE.Raycaster collision detection to prevent wall clipping.
4. Autonomous AI NPC Navigation: A fully rigged 3D character that uses $A^*$ grid pathfinding to continuously walk from painting to painting.
5. Real-time Minimap: A dynamic 2D canvas displaying live visitor position, view direction, wall geometry, and NPC tracking.
  
🛠️ **Tech Stack**

Graphics Engine: Three.js 

Pathfinding: Pathfinding.js ($A^*$ Grid Search)

Bundler: Vite (TypeScript / Vanilla JS)

Deployment: Vercel📦 Local Installation & SetupFollow these instructions to run the project locally on your machine.



**Prerequisites**
Make sure you have Node.js installed on your computer.
1. Clone the Repository
   
git clone https://github.com/username/virtual-museum-project.git

cd virtual-museum-project

2. Install Dependencies 

npm install

3. Add AssetsImages: Place your custom artwork images (.jpg, .png, .webp) inside the src/textures/ folder. The application will automatically detect and load them. Ensure your rigged character model is placed at public/models/human.glb.
4. Run the Development Server npm run dev
Open your browser and navigate to http://localhost:5173.




📂 **Project Structure**

virtual-museum-project/

├── public/

│   └── models/

│       └── human.glb        # Rigged 3D human character model


├── src/

│   ├── textures/            # Dynamic gallery artwork folder

│   ├── grid.ts              # Museum layout coordinate matrices (Classical, Modern, Maze)

│   ├── main.ts              # Core Three.js scene, camera, raycasting, and NPC loop

│   └── style.css            # UI styling for entry screen and minimap overlay


├── index.html               # Main entry HTML with UI overlay overlays


├── package.json             # Project dependencies and build scripts


└── README.md                # Project documentation
