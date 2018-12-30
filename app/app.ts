﻿import { SkillTreeData } from "../models/SkillTreeData";
import { Utils } from "./utils";
import * as PIXI from "pixi.js";;
import * as Viewport from "pixi-viewport";
import * as $ from "jquery";

namespace App {
    let skillTreeData: SkillTreeData;
    let pixi: PIXI.Application;
    let viewport: Viewport;
    export const main = async () => {
        skillTreeData = new SkillTreeData(await $.ajax({
            url: `/data/SkillTree.json?t=${(new Date()).getTime()}`,
            dataType: 'json'
        }));

        pixi = new PIXI.Application(window.innerWidth, window.innerHeight, {
            autoResize: true,
            resolution: devicePixelRatio
        });
        document.body.appendChild(pixi.view);

        viewport = new Viewport({
            screenWidth: pixi.screen.width,
            screenHeight: pixi.screen.height,
            worldWidth: skillTreeData.width / 2.4,
            worldHeight: skillTreeData.height / 2.4,
            interaction: pixi.renderer.plugins.interaction
        });
        viewport
            .drag()
            .wheel()
            .pinch();
        pixi.stage.addChild(viewport);
        $(window).on("resize", () => {
            pixi.renderer.resize(window.innerWidth, window.innerHeight);
            viewport.resize(pixi.renderer.width, pixi.renderer.height, skillTreeData.width, skillTreeData.height);
        });

        PIXI.Loader.shared.reset();
        let added_assets = new Array<string>();
        for (let id in skillTreeData.assets) {
            let asset = skillTreeData.assets[id];
            var max_zoom = skillTreeData.imageZoomLevels[skillTreeData.imageZoomLevels.length - 1];
            if (asset[max_zoom] && added_assets.indexOf(id) < 0) {
                added_assets.push(id);
                PIXI.Loader.shared.add(`data/assets/${id}.png`);
            }
        }
        for (let id in skillTreeData.skillSprites) {
            let sprites = skillTreeData.skillSprites[id];
            let sprite = sprites[sprites.length - 1];
            if (sprite && added_assets.indexOf(sprite.filename) < 0) {
                added_assets.push(sprite.filename);
                PIXI.Loader.shared.add(`data/assets/${sprite.filename}`);
            }
        }
        PIXI.Loader.shared.load();
        PIXI.Loader.shared.onComplete.add(() => {
            draw();
        });
    }


    export const events = () => {
        viewport.on('clicked', () => console.log('clicked'))
        viewport.on('drag-start', () => console.log('drag-start'))
        viewport.on('drag-end', () => console.log('drag-end'))
        viewport.on('pinch-start', () => console.log('pinch-start'))
        viewport.on('pinch-end', () => console.log('pinch-end'))
        viewport.on('snap-start', () => console.log('snap-start'))
        viewport.on('snap-end', () => console.log('snap-end'))
        viewport.on('snap-zoom-start', () => console.log('snap-zoom-start'))
        viewport.on('snap-zoom-end', () => console.log('snap-zoom-end'))
        viewport.on('moved-end', () => console.log('moved-end'))
        viewport.on('zoomed-end', () => console.log('zoomed-end'))
    }

    export const draw = (): void => {
        viewport.removeChildren();
        //we like the highest res images
        var max_zoom = skillTreeData.imageZoomLevels[skillTreeData.imageZoomLevels.length - 1];
        let background: PIXI.Container = new PIXI.Container();
        let connections: PIXI.Container = new PIXI.Container();
        let skillIcons: PIXI.Container = new PIXI.Container();
        let characterStarts: PIXI.Container = new PIXI.Container();


        let background_graphic = PIXI.TilingSprite.from('data/assets/Background1.png', skillTreeData.width / 2.4, skillTreeData.height / 2.4);
        background_graphic.position.set(skillTreeData.min_x / 2.4, skillTreeData.min_y / 2.4);
        background.addChild(background_graphic);

        let drawn_connections: { [id: number]: Array<number> } = {};
        for (let id in skillTreeData.nodes) {
            var node = skillTreeData.nodes[id];
            let nodes = node.in
                .filter((outID) => {
                    if (drawn_connections[outID] === undefined || drawn_connections[+id] === undefined) {
                        return true;
                    } else {
                        return drawn_connections[outID].indexOf(+id) < 0 && drawn_connections[+id].indexOf(outID) < 0;
                    }
                })
                .map((outID) => {
                    if (drawn_connections[outID] === undefined) {
                        drawn_connections[outID] = new Array<number>();
                    }
                    if (drawn_connections[+id] === undefined) {
                        drawn_connections[+id] = new Array<number>();
                    }
                    drawn_connections[outID].push(+id);
                    drawn_connections[+id].push(outID);

                    return skillTreeData.nodes[outID]
                });
            connections.addChild(node.createConnections(nodes));
            skillIcons.addChild(node.createNodeGraphic(skillTreeData.skillSprites, skillTreeData.imageZoomLevels.length - 1));
            skillIcons.addChild(node.createNodeFrame("Unallocated"));
        }

        for (let id of skillTreeData.root.out) {
            let node = skillTreeData.nodes[id];
            if (node.spc.length !== 1) {
                // Root node with no/multiple classes?
                continue;
            }

            let class_name = Utils.getKeyByValue(skillTreeData.constants.classes, node.spc[0]);
            if (class_name === undefined) {
                throw new Error(`Couldn't find class name from constants: ${node.spc[0]}`);
            }

            let class_name_backgrouds = skillTreeData.assets[`Background${class_name.replace("Class", "")}`];
            let class_name_backgroud = "";
            if (class_name_backgrouds) {
                if (max_zoom in class_name_backgrouds) {
                    class_name_backgroud = class_name_backgrouds[max_zoom];
                } else {
                    class_name_backgroud = class_name_backgrouds[0];
                }
                let class_file_name = class_name_backgroud.slice(class_name_backgroud.lastIndexOf('/') + 1);
                let class_url = `data/assets/Background${class_name.replace("Class", "").toLocaleLowerCase()}${class_file_name.slice(class_file_name.lastIndexOf('.'))}`;
                let class_node_graphic = PIXI.Sprite.from(class_url);
                class_node_graphic.anchor.set(.5, .5)
                class_node_graphic.position.set(node.group.x / 2.5, node.group.y / 2.5);
            }

            let common_name = skillTreeData.constants.classesToName[class_name];

            //find center
            //TODO: make asset loader
            let class_backgrounds = skillTreeData.assets[`center${common_name.toLocaleLowerCase()}`];
            let class_background = "";
            if (class_backgrounds) {
                if (max_zoom in class_backgrounds) {
                    class_background = class_backgrounds[max_zoom];
                } else {
                    class_background = class_backgrounds[0];
                }
                //get file name
                let file_name = class_background.slice(class_background.lastIndexOf('/') + 1);
                let node_url = `data/assets/center${common_name.toLocaleLowerCase()}${file_name.slice(file_name.lastIndexOf('.'))}`;
                let node_graphic = PIXI.Sprite.from(node_url);
                node_graphic.anchor.set(.5)
                node_graphic.position.set(node.x, node.y);
                characterStarts.addChild(node_graphic);
            }
        }

        viewport.addChild(background);
        viewport.addChild(connections);
        viewport.addChild(skillIcons);
        viewport.addChild(characterStarts);

        viewport.fitWorld(true);
        viewport.zoomPercent(1.5);
        drawActive();
    }

    let connections_active: PIXI.Container = new PIXI.Container();
    let skillIcons_active: PIXI.Container = new PIXI.Container();
    export const drawActive = () => {
        viewport.removeChild(connections_active);
        viewport.removeChild(skillIcons_active);
        connections_active.removeChildren();
        skillIcons_active.removeChildren();

        let drawn_connections: { [id: number]: Array<number> } = {};
        for (let id in skillTreeData.nodes) {
            var node = skillTreeData.nodes[id];
            if (!node.active) {
                continue;
            }
            let nodes = node.in
                .filter((outID) => {
                    if (drawn_connections[outID] === undefined || drawn_connections[+id] === undefined) {
                        return true;
                    } else {
                        return drawn_connections[outID].indexOf(+id) < 0 && drawn_connections[+id].indexOf(outID) < 0;
                    }
                })
                .map((outID) => {
                    if (drawn_connections[outID] === undefined) {
                        drawn_connections[outID] = new Array<number>();
                    }
                    if (drawn_connections[+id] === undefined) {
                        drawn_connections[+id] = new Array<number>();
                    }
                    drawn_connections[outID].push(+id);
                    drawn_connections[+id].push(outID);

                    return skillTreeData.nodes[outID]
                });
            connections_active.addChild(node.createConnections(nodes));
            skillIcons_active.addChild(node.createNodeGraphic(skillTreeData.skillSprites, skillTreeData.imageZoomLevels.length - 1));

            for (let out of nodes) {
                skillIcons_active.addChild(out.createNodeFrame("CanAllocate"));
            }
            skillIcons_active.addChild(node.createNodeFrame("Allocated"));
        }

        viewport.addChildAt(connections_active, 2);
        viewport.addChildAt(skillIcons_active, 4);
        requestAnimationFrame(drawActive);
    }
}

$(window).on("load", () => {
    App.main();
});