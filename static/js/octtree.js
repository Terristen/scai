class OctTree {
    constructor(min, max) {
      this.min = min;
      this.max = max;
      this.value = null; // optional value stored at root
      this.children = [];
      for (let i = 0; i < 8; i++) {
        this.children.push(null);
      }
    }
  
    insert(coord3, value) {
      if (!this.isLeaf()) {
        let index = coord3.x >= this.max.x / 2 ? 4 : 0;
        index += coord3.y >= this.max.y / 2 ? 2 : 0;
        index += coord3.z >= this.max.z / 2 ? 1 : 0;
        if (!this.children[index]) {
          this.children[index] = new OctTree(
            { x: Math.min(this.min.x, coord3.x), 
              y: Math.min(this.min.y, coord3.y),
              z: Math.min(this.min.z, coord3.z) },
            { x: Math.max(this.max.x, coord3.x), 
              y: Math.max(this.max.y, coord3.y),
              z: Math.max(this.max.z, coord3.z) }
          );
        }
        this.children[index].insert(coord3, value);
      } else {
        // store value at leaf node
        this.value = value;
      }
    }
  
    query(min, max) {
      if (this.isLeaf()) {
        if (max.x >= this.max.x && min.x <= this.min.x &&
            max.y >= this.max.y && min.y <= this.min.y &&
            max.z >= this.max.z && min.z <= this.min.z) {
          return [this.value];
        } else {
          return [];
        }
      }
  
      let results = [];
      for (let i = 0; i < 8; i++) {
        if (!this.children[i]) continue;
        let childMin, childMax;
        switch (i) {
          case 0: 
            childMin = { x: this.min.x, y: this.min.y, z: this.min.z };
            childMax = { x: this.max.x / 2, y: this.max.y / 2, z: this.max.z / 2 };
            break;
          case 1:
            childMin = { x: this.max.x / 2 + 0.00001, y: this.min.y, z: this.min.z };
            childMax = { x: this.max.x, y: this.max.y / 2, z: this.max.z / 2 };
            break;
          case 2:
            childMin = { x: this.max.x / 2 + 0.00001, y: this.max.y / 2 + 0.00001, z: this.min.z };
            childMax = { x: this.max.x, y: this.max.y, z: this.max.z / 2 };
            break;
          case 3:
            childMin = { x: this.min.x, y: this.max.y / 2 + 0.00001, z: this.min.z };
            childMax = { x: this.max.x / 2, y: this.max.y, z: this.max.z / 2 };
            break;
          case 4:
            childMin = { x: this.max.x / 2, y: this.min.y, z: this.min.z };
            childMax = { x: this.max.x, y: this.max.y / 2, z: this.max.z / 2 };
            break;
          case 5:
            childMin = { x: this.max.x / 2 + 0.00001, y: this.max.y / 2 + 0.00001, z: this.min.z };
            childMax = { x: this.max.x, y: this.max.y, z: this.max.z / 2 };
            break;
          case 6:
            childMin = { x: this.min.x, y: this.max.y / 2 + 0.00001, z: this.max.z / 2 + 0.00001};
            childMax = { x: this.max.x / 2, y: this.max.y, z: this.max.z };
            break;
          case 7:
            childMin = { x: this.max.x / 2, y: this.min.y, z: this.max.z / 2 + 0.00001};
            childMax = { x: this.max.x, y: this.max.y / 2, z: this.max.z };
            break;
          default:
            throw new Error("Invalid octant");
        }
  
        results = results.concat(this.children[i].query(childMin, childMax));
      }
      return results;
    }
  
    isLeaf() {
      for (let child of this.children) {
        if (child != null) return false;
      }
      return true;
    }
  }
  
  /* Usage:
    let octree = new OctTree({ x: -100, y: -100, z: -100 }, { x: 100, y: 100, z: 100 });
    octree.insert({x: 1, y: 2, z: 3}, "Value at (1,2,3)");
    octree.insert({x: 4, y: 5, z: 6}, "Value at (4,5,6)");

    console.log(octree.query({ x: 0, y: 0, z: 0 }, { x: 5, y: 5, z: 5 }));
    // Output: ["Value at (1,2,3)"]
*/


