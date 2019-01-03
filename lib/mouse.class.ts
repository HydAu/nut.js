import {NativeAdapter} from "./adapter/native.adapter.class";
import {Button} from "./button.enum";
import {Config} from "./config.class";
import {MovementType} from "./movementtype.class";
import {Point} from "./point.class";

export class Mouse {
    constructor(private config: Config, private native: NativeAdapter) {
    }

    public setDelay(delay: number): void {
        this.native.setMouseDelay(delay);
    }

    public setPosition(target: Point): void {
        this.native.setMousePosition(target);
    }

    public getPosition(): Point {
        return this.native.currentMousePosition();
    }

    public move(path: Point[], movementType = MovementType.linear): void {
        const timeSteps = movementType(path.length, this.config.mouseSpeed);
        for (let idx = 0; idx < path.length; ++idx) {
            const node = path[idx];
            const minTime = timeSteps[idx];
            const previous = Date.now();
            let current = Date.now();
            while (current - previous < minTime) {
                current = Date.now();
            }
            this.native.setMousePosition(node);
        }
    }

    public leftClick(): void {
        this.native.leftClick();
    }

    public rightClick(): void {
        this.native.rightClick();
    }

    public drag(path: Point[]): void {
        this.native.pressButton(Button.LEFT);
        this.move(path);
        this.native.releaseButton(Button.LEFT);
    }
}
