import { SkillTreeData } from "../../models/SkillTreeData";
import { SkillNode, SkillNodeStates } from "../../models/SkillNode";
import { FibonacciHeap, MaxFibonacciHeap } from "mnemonist";


export class ScienceAlgorithm {
    skillTreeData: SkillTreeData;
    initialFixedSet: PotentialTree[];

    constructor(treeData: SkillTreeData) {
        this.skillTreeData = treeData;
        
        this.initialFixedSet = []
        const nodes = Object.values(this.skillTreeData.nodes).sort((a,b) => a.skill - b.skill);
        for(const node of nodes){
            this.initialFixedSet.push(new PotentialTree(node, []))
        }
    }

    Execute(): void {
        //console.time('Prep check')

        
        const nodesToDisable = Object.values(this.skillTreeData.getNodes(SkillNodeStates.Active)).filter(node => node.classStartIndex === undefined && !node.isAscendancyStart)
        for (const node of nodesToDisable){
            this.skillTreeData.removeState(node, SkillNodeStates.Active);
        }


        const desiredNodes = Object.values(this.skillTreeData.getNodes(SkillNodeStates.Desired)).filter(node => !node.isAscendancyStart && node.classStartIndex === undefined).sort((a,b) => a.skill - b.skill);
        const distances: {[potentialTreeHash: string]: number} = {}
        const parent: {[potentialTreeHash: string]: PotentialTree[]} = {}

        const heap = new FibonacciHeap<PotentialTree>((a,b) => {
            const distA = distances[a.getHash()] ?? 0;
            const distB = distances[b.getHash()] ?? 0;
            return (distA + 0) - (distB + 0);
        })

        const fixedSet: {[hash: string]: PotentialTree} = {}

        for(const node of desiredNodes){
            const potential = new PotentialTree(node, [node])
            heap.push(potential);
            distances[potential.getHash()] = 0
        }

        for(const potentialTree of this.initialFixedSet){
            const newPotential = new PotentialTree(potentialTree.specialNode, potentialTree.desiredNodesHit)
            fixedSet[newPotential.getHash()] = newPotential
            distances[newPotential.getHash()] = 0
        }

        let finalPop: PotentialTree | undefined = undefined;
        
        //console.timeEnd('Prep check')
        let checkCount = 0
        while(heap.size > 0){
            checkCount++
            //Get item with lowest distance
            const heapPop = heap.pop();
            if(heapPop === undefined) break;
            fixedSet[heapPop.getHash()] = heapPop

            //Get adjacent node IDs
            const adjacent = [...new Set([...heapPop.specialNode.out, ...heapPop.specialNode.in])].filter(nodeId => this.skillTreeData.nodes[nodeId].ascendancyName === '' && !this.skillTreeData.nodes[nodeId].is(SkillNodeStates.UnDesired))

            for(const adjacentNode of adjacent){
                // New potential tree with the adjacent node but the same desired nodes
                const newPotential = new PotentialTree(this.skillTreeData.nodes[adjacentNode], heapPop.desiredNodesHit)
                // If we already have the new potential, skip
                if(fixedSet[newPotential.getHash()] !== undefined) continue;

                // Grab the distances
                const heapPopDistance = distances[heapPop.getHash()];
                const adjDistance = distances[newPotential.getHash()] ?? 10000000;

                // If the new potential tree doesn't have a distance, set it and it's parents
                if(heapPopDistance + 1 < adjDistance){
                    distances[newPotential.getHash()] = heapPopDistance + 1;
                    parent[newPotential.getHash()] = [heapPop];
                    heap.push(newPotential)
                }
            }
            
            //console.time('Fixed check')
            for(const fixedTree of Object.values(fixedSet)){
                if(fixedTree.specialNode === heapPop.specialNode){
                    
                    //console.time('Disjoint check')
                    let disjoint = true;
                    const nodesHit: {[nodeId: string]: SkillNode} = {}
                    for(const node of heapPop.desiredNodesHit){
                        nodesHit[node.skill] = node;
                    }
                    for(const node of fixedTree.desiredNodesHit){
                        if(nodesHit[node.skill] !== undefined)
                            disjoint = false;
                    }
                    //console.timeEnd('Disjoint check')

                    //console.time('New tree check')
                    if(disjoint){
                        const combined = new PotentialTree(fixedTree.specialNode, fixedTree.desiredNodesHit.concat(heapPop.desiredNodesHit));
                        const heapPopDistance = distances[heapPop.getHash()];
                        const fixedDistance = distances[fixedTree.getHash()];
                        const existingCombinedDistance = distances[combined.getHash()]
                        const combinedDistance = heapPopDistance + fixedDistance;

                        if(existingCombinedDistance === undefined || combinedDistance < existingCombinedDistance){
                            distances[combined.getHash()] = combinedDistance;
                            parent[combined.getHash()] = [fixedTree, heapPop];
                            heap.push(combined);
                        }
                    }
                    //console.timeEnd('New tree check')
                }
            }
            //console.timeEnd('Fixed check')
            
            if(heapPop.specialNode.classStartIndex === this.skillTreeData.getStartClass() && heapPop.desiredNodesHit.map(n => n.skill).join() === desiredNodes.map(n => n.skill).join()){
                finalPop = heapPop;
                break;
            }                
        }
        if(finalPop === undefined)
            return;

        let parentQueue: PotentialTree[] | undefined = parent[finalPop.getHash()];
        const path = new Set<SkillNode>().add(finalPop.specialNode);
        let count2 = 0;
        //console.log(checkCount)
        while (parentQueue.length > 0 && count2++ < 100) {
            const nextTree = parentQueue.pop();
            if(nextTree === undefined) break;
            path.add(nextTree.specialNode);
            const nextParent = parent[nextTree.getHash()]
            if(nextParent !== undefined){
                if(nextParent[0] !== undefined) parentQueue.push(nextParent[0])
                if(nextParent[1] !== undefined) parentQueue.push(nextParent[1])
            }            
        }
        for(const node of path){
            if(!node.is(SkillNodeStates.Active)){
                this.skillTreeData.addState(node, SkillNodeStates.Active)
            }
        }
    }
}

class PotentialTree {
    specialNode: SkillNode;
    desiredNodesHit: SkillNode[];

    constructor(specialNode: SkillNode, desiredNodesHit: SkillNode[]){
        this.specialNode = specialNode;
        this.desiredNodesHit = desiredNodesHit.sort((a,b) => a.skill - b.skill);
    }
    
    getHash(): string {        
        return this.specialNode.skill + '-' + (this.desiredNodesHit.map(node => node.skill).sort((a,b) => Number(a) - Number(b)).join('-'))
    }
}