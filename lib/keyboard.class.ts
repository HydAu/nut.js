import {Key} from "./key.enum";
import {sleep} from "./sleep.function";
import {ProviderRegistry} from "./provider/provider-registry.class";

type StringOrKey = string[] | Key[];

const inputIsString = (input: (string | Key)[]): input is string[] => {
    return input.every((elem: string | Key) => typeof elem === "string");
};

/**
 * {@link KeyboardClass} class provides methods to emulate keyboard input
 */
export class KeyboardClass {

    /**
     * Config object for {@link KeyboardClass} class
     */
    public config = {
        /**
         * Configures the delay between single key events
         */
        autoDelayMs: 300,
    };

    /**
     * {@link KeyboardClass} class constructor
     * @param providerRegistry
     */
    constructor(private providerRegistry: ProviderRegistry) {
        this.providerRegistry.getKeyboard().setKeyboardDelay(this.config.autoDelayMs);
    }

    /**
     * {@link type} types a sequence of {@link String} or single {@link Key}s via system keyboard
     * @example
     * ```typescript
     *    await keyboard.type(Key.A, Key.S, Key.D, Key.F);
     *    await keyboard.type("Hello, world!");
     * ```
     *
     * @param input Sequence of {@link String} or {@link Key} to type
     */
    public type(...input: StringOrKey): Promise<KeyboardClass> {
        return new Promise<KeyboardClass>(async (resolve, reject) => {
            try {
                if (inputIsString(input)) {
                    for (const char of input.join(" ")) {
                        await sleep(this.config.autoDelayMs);
                        await this.providerRegistry.getKeyboard().type(char);
                    }
                } else {
                    await this.providerRegistry.getKeyboard().click(...input as Key[]);
                }
                resolve(this);
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * {@link pressKey} presses and holds a single {@link Key} for {@link Key} combinations
     * Modifier {@link Key}s are to be given in "natural" ordering, so first modifier {@link Key}s, followed by the {@link Key} to press
     * @example
     * ```typescript
     *    // Will press and hold key combination STRG + V
     *    await keyboard.pressKey(Key.STRG, Key.V);
     * ```
     *
     * @param keys Array of {@link Key}s to press and hold
     */
    public pressKey(...keys: Key[]): Promise<KeyboardClass> {
        return new Promise<KeyboardClass>(async (resolve, reject) => {
            try {
                await sleep(this.config.autoDelayMs);
                await this.providerRegistry.getKeyboard().pressKey(...keys);
                resolve(this);
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * {@link pressKey} releases a single {@link Key} for {@link Key} combinations
     * Modifier {@link Key}s are to be given in "natural" ordering, so first modifier {@link Key}s, followed by the {@link Key} to press
     * @example
     * ```typescript
     *    // Will release key combination STRG + V
     *    await keyboard.releaseKey(Key.STRG, Key.V);
     * ```
     *
     * @param keys Array of {@link Key}s to release
     */
    public releaseKey(...keys: Key[]): Promise<KeyboardClass> {
        return new Promise<KeyboardClass>(async (resolve, reject) => {
            try {
                await sleep(this.config.autoDelayMs);
                await this.providerRegistry.getKeyboard().releaseKey(...keys);
                resolve(this);
            } catch (e) {
                reject(e);
            }
        });
    }
}
