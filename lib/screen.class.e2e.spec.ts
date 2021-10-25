import {existsSync} from "fs";
import {VisionAdapter} from "./adapter/vision.adapter.class";
import {FileType} from "./file-type.enum";
import {ScreenClass} from "./screen.class";
import {sleep} from "./sleep.function";
import AbortController from "node-abort-controller";
import {Region} from "./region.class";
import providerRegistry from "./provider/provider-registry.class";

jest.setTimeout(10000);

describe("Screen.", () => {
    it("should capture the screen", () => {
        // GIVEN
        const visionAdapter = new VisionAdapter(providerRegistry);
        const SUT = new ScreenClass(visionAdapter);

        // WHEN
        SUT.capture("asdf", FileType.PNG).then(filename => {
            // THEN
            expect(filename).not.toBeNull();
            sleep(1000).then(() => {
                expect(existsSync(filename)).toBeTruthy();
            });
        });
    });

    it("should capture the screen and save to JPG", () => {
        // GIVEN
        const visionAdapter = new VisionAdapter(providerRegistry);
        const SUT = new ScreenClass(visionAdapter);

        // WHEN
        SUT.capture("asdf", FileType.JPG).then(filename => {
            // THEN
            expect(filename).not.toBeNull();
            sleep(1000).then(() => {
                expect(existsSync(filename)).toBeTruthy();
            });
        });
    });

    it("should capture the screen and save file with prefix", () => {
        // GIVEN
        const visionAdapter = new VisionAdapter(providerRegistry);
        const SUT = new ScreenClass(visionAdapter);
        const prefix = "foo_";

        // WHEN
        SUT.capture("asdf", FileType.JPG, "./", prefix).then(filename => {
            // THEN
            expect(filename.includes(prefix)).toBeTruthy();
            expect(filename).not.toBeNull();
            sleep(1000).then(() => {
                expect(existsSync(filename)).toBeTruthy();
            });
        });
    });

    it("should capture the screen and save file with postfix", () => {
        // GIVEN
        const visionAdapter = new VisionAdapter(providerRegistry);
        const SUT = new ScreenClass(visionAdapter);
        const postfix = "_bar";

        // WHEN
        SUT.capture("asdf", FileType.JPG, "./", "", postfix).then(filename => {
            // THEN
            expect(filename.includes(postfix)).toBeTruthy();
            expect(filename).not.toBeNull();
            sleep(1000).then(() => {
                expect(existsSync(filename)).toBeTruthy();
            });
        });
    });

    it("should capture the screen and save file with pre- and postfix", () => {
        // GIVEN
        const visionAdapter = new VisionAdapter(providerRegistry);
        const SUT = new ScreenClass(visionAdapter);
        const filename = "asdf";
        const prefix = "foo_";
        const postfix = "_bar";

        // WHEN
        SUT.capture("asdf", FileType.JPG, "./", prefix, postfix).then(output => {
            // THEN
            expect(output.includes(`${prefix}${filename}${postfix}`)).toBeTruthy();
            expect(output).not.toBeNull();
            sleep(1000).then(() => {
                expect(existsSync(output)).toBeTruthy();
            });
        });
    });

    it("should reject after timeout", async () => {
        // GIVEN
        const timeout = 5000;
        const visionAdapter = new VisionAdapter(providerRegistry);
        const SUT = new ScreenClass(visionAdapter);
        SUT.config.resourceDirectory = "./e2e/assets";

        // WHEN
        const start = Date.now();
        try {
            await SUT.waitFor("calculator.png", timeout);
        } catch (e) {
            // THEN
            expect(e).toBe(`Action timed out after ${timeout} ms`);
        }
        const end = Date.now();

        // THEN
        expect(end - start).toBeGreaterThanOrEqual(timeout);
    });

    it("should abort via signal", (done) => {
        // GIVEN
        const timeout = 5000;
        const abortAfterMs = 1000;
        const controller = new AbortController();
        const signal = controller.signal;
        const visionAdapter = new VisionAdapter(providerRegistry);
        const SUT = new ScreenClass(visionAdapter);
        SUT.config.resourceDirectory = "./e2e/assets";

        // WHEN
        const start = Date.now();
        SUT.waitFor("calculator.png", timeout, {abort: signal}).catch(e => {
            const end = Date.now();

            // THEN
            expect(e).toBe(`Action aborted by signal`);
            expect(end - start).toBeGreaterThanOrEqual(abortAfterMs);
            expect(end - start).toBeLessThan(timeout);
            done();
        });
        setTimeout(() => controller.abort(), abortAfterMs);
    });

    it("should grab the whole screen content and return an Image", async () => {
        // GIVEN
        const visionAdapter = new VisionAdapter(providerRegistry);
        const SUT = new ScreenClass(visionAdapter);
        const screenWidth = await SUT.width();
        const screenHeight = await SUT.height();

        // WHEN
        const image = await SUT.grab();

        // THEN
        expect(image.data).not.toBeUndefined();
        expect(image.width / image.pixelDensity.scaleX).toBe(screenWidth);
        expect(image.height / image.pixelDensity.scaleY).toBe(screenHeight);
    });

    it("should grab a screen region and return an Image", async () => {
        // GIVEN
        const visionAdapter = new VisionAdapter(providerRegistry);
        const SUT = new ScreenClass(visionAdapter);
        const regionToGrab = new Region(0, 0, 100, 100);

        // WHEN
        const image = await SUT.grabRegion(regionToGrab);

        // THEN
        expect(image.data).not.toBeUndefined();
        expect(image.width / image.pixelDensity.scaleX).toBe(regionToGrab.width);
        expect(image.height / image.pixelDensity.scaleY).toBe(regionToGrab.height);
    });
});
