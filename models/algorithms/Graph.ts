import { FibonacciHeap } from "mnemonist";

export class Graph {
    totalWeight: number;
    edges: FibonacciHeap<Edge>;
    addedEdges: Edge[];

    constructor() {
        this.totalWeight = 0;
        this.edges = new FibonacciHeap<Edge>((a,b) => a.weight - b.weight);
        this.addedEdges = [];
    }
    
    addEdge(lowerNode: string, higherNode: string, weight: number){
        const edgeExists = this.addedEdges.findIndex(edge => edge.lowerNode === lowerNode && edge.higherNode === higherNode) !== -1;

        if(!edgeExists){
            const newEdge = new Edge(lowerNode, higherNode, weight)
            this.edges.push(newEdge);
            this.addedEdges.push(newEdge);
            this.totalWeight += weight;
        }
    }
}

class Edge {
    lowerNode: string;
    higherNode: string;
    weight: number;

    constructor(lowerNode: string, higherNode: string, weight: number){
        if (lowerNode === higherNode) {
            throw Error('Self referential edge created');
        }

        this.lowerNode = lowerNode;
        this.higherNode = higherNode;
        this.weight = weight;
    }
}