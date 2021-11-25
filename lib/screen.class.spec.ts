import {join} from "path";
import {cwd} from "process";
import {Image} from "./image.class";
import {LocationParameters} from "./locationparameters.class";
import {MatchRequest} from "./match-request.class";
import {MatchResult} from "./match-result.class";
import {Region} from "./region.class";
import {ScreenClass} from "./screen.class";
import {mockPartial} from "sneer";
import {ProviderRegistry} from "./provider/provider-registry.class";
import {ImageFinderInterface, ImageWriter, ScreenProviderInterface} from "./provider";

jest.mock('jimp', () => {
});

const searchRegion = new Region(0, 0, 1000, 1000);

const providerRegistryMock = mockPartial<ProviderRegistry>({
    getScreen(): ScreenProviderInterface {
        return mockPartial<ScreenProviderInterface>({
            grabScreenRegion(): Promise<Image> {
                return Promise.resolve(new Image(searchRegion.width, searchRegion.height, new ArrayBuffer(0), 3));
            },
            screenSize(): Promise<Region> {
                return Promise.resolve(searchRegion);
            }
        })
    }
});

beforeEach(() => {
    jest.resetAllMocks();
});

describe("Screen.", () => {
    describe("find", () => {
        it("should resolve with sufficient confidence.", async () => {
            // GIVEN
            const matchResult = new MatchResult(0.99, searchRegion);
            const SUT = new ScreenClass(providerRegistryMock);
            const needle = new Image(100, 100, Buffer.from([]), 3);

            const findMatchMock = jest.fn(() => Promise.resolve(matchResult));
            providerRegistryMock.getImageFinder = jest.fn(() => mockPartial<ImageFinderInterface>({
                findMatch: findMatchMock
            }));

            // WHEN
            const resultRegion = SUT.find(needle);

            // THEN
            await expect(resultRegion).resolves.toEqual(matchResult.location);
            const matchRequest = new MatchRequest(
                expect.any(Image),
                needle,
                SUT.config.confidence,
                true);
            expect(findMatchMock).toHaveBeenCalledWith(matchRequest);
        });

        it("should call registered hook before resolve", async () => {
            // GIVEN
            const matchResult = new MatchResult(0.99, searchRegion);
            const findMatchMock = jest.fn(() => Promise.resolve(matchResult));
            providerRegistryMock.getImageFinder = jest.fn(() => mockPartial<ImageFinderInterface>({
                findMatch: findMatchMock
            }));

            const SUT = new ScreenClass(providerRegistryMock);
            const testCallback = jest.fn(() => Promise.resolve());
            const needle = new Image(100, 100, Buffer.from([]), 3);
            SUT.on(needle, testCallback);

            // WHEN
            await SUT.find(needle);

            // THEN
            expect(testCallback).toBeCalledTimes(1);
            expect(testCallback).toBeCalledWith(matchResult);
        });

        it("should call multiple registered hooks before resolve", async () => {
            // GIVEN
            const matchResult = new MatchResult(0.99, searchRegion);
            const findMatchMock = jest.fn(() => Promise.resolve(matchResult));
            providerRegistryMock.getImageFinder = jest.fn(() => mockPartial<ImageFinderInterface>({
                findMatch: findMatchMock
            }));

            const SUT = new ScreenClass(providerRegistryMock);
            const testCallback = jest.fn(() => Promise.resolve());
            const secondCallback = jest.fn(() => Promise.resolve());
            const needle = new Image(100, 100, Buffer.from([]), 3);
            SUT.on(needle, testCallback);
            SUT.on(needle, secondCallback);

            // WHEN
            await SUT.find(needle);

            // THEN
            for (const callback of [testCallback, secondCallback]) {
                expect(callback).toBeCalledTimes(1);
                expect(callback).toBeCalledWith(matchResult);
            }
        });

        it("should reject with insufficient confidence.", async () => {

            // GIVEN
            const matchResult = new MatchResult(0.8, searchRegion);
            const findMatchMock = jest.fn(() => Promise.resolve(matchResult));
            providerRegistryMock.getImageFinder = jest.fn(() => mockPartial<ImageFinderInterface>({
                findMatch: findMatchMock
            }));

            const SUT = new ScreenClass(providerRegistryMock);
            const needle = new Image(100, 100, Buffer.from([]), 3);

            // WHEN
            const resultRegion = SUT.find(needle);

            // THEN
            await expect(resultRegion)
                .rejects
                .toEqual(`No match for image. Required: ${SUT.config.confidence}, given: ${matchResult.confidence}`);
        });

        it("should reject when search fails.", async () => {

            // GIVEN
            const rejectionReason = "Search failed.";
            const findMatchMock = jest.fn(() => Promise.reject(rejectionReason));
            providerRegistryMock.getImageFinder = jest.fn(() => mockPartial<ImageFinderInterface>({
                findMatch: findMatchMock
            }));

            const SUT = new ScreenClass(providerRegistryMock);
            const needle = new Image(100, 100, Buffer.from([]), 3);

            // WHEN
            const resultRegion = SUT.find(needle);

            // THEN
            await expect(resultRegion)
                .rejects
                .toEqual(`Searching for image failed. Reason: '${rejectionReason}'`);
        });

        it("should override default confidence value with parameter.", async () => {

            // GIVEN
            const minMatch = 0.8;
            const matchResult = new MatchResult(minMatch, searchRegion);

            const findMatchMock = jest.fn(() => Promise.resolve(matchResult));
            providerRegistryMock.getImageFinder = jest.fn(() => mockPartial<ImageFinderInterface>({
                findMatch: findMatchMock
            }));

            const SUT = new ScreenClass(providerRegistryMock);

            const needle = new Image(100, 100, Buffer.from([]), 3);
            const parameters = new LocationParameters(undefined, minMatch);

            // WHEN
            const resultRegion = SUT.find(needle, parameters);

            // THEN
            await expect(resultRegion).resolves.toEqual(matchResult.location);
            const matchRequest = new MatchRequest(
                expect.any(Image),
                needle,
                minMatch,
                true);
            expect(findMatchMock).toHaveBeenCalledWith(matchRequest);
        });

        it("should override default search region with parameter.", async () => {
            // GIVEN
            const customSearchRegion = new Region(10, 10, 90, 90);
            const matchResult = new MatchResult(0.99, searchRegion);

            const findMatchMock = jest.fn(() => Promise.resolve(matchResult));
            providerRegistryMock.getImageFinder = jest.fn(() => mockPartial<ImageFinderInterface>({
                findMatch: findMatchMock
            }));

            const SUT = new ScreenClass(providerRegistryMock);

            const needle = new Image(100, 100, Buffer.from([]), 3);
            const parameters = new LocationParameters(customSearchRegion);
            const expectedMatchRequest = new MatchRequest(
                expect.any(Image),
                needle,
                SUT.config.confidence,
                true);

            // WHEN
            await SUT.find(needle, parameters);

            // THEN
            expect(findMatchMock).toHaveBeenCalledWith(expectedMatchRequest);
        });

        it("should override searchMultipleScales with parameter.", async () => {
            // GIVEN
            const matchResult = new MatchResult(0.99, searchRegion);
            const findMatchMock = jest.fn(() => Promise.resolve(matchResult));
            providerRegistryMock.getImageFinder = jest.fn(() => mockPartial<ImageFinderInterface>({
                findMatch: findMatchMock
            }));

            const SUT = new ScreenClass(providerRegistryMock);
            const needle = new Image(100, 100, Buffer.from([]), 3);

            const parameters = new LocationParameters(searchRegion, undefined, false);
            const expectedMatchRequest = new MatchRequest(
                expect.any(Image),
                needle,
                SUT.config.confidence,
                false);

            // WHEN
            await SUT.find(needle, parameters);

            // THEN
            expect(findMatchMock).toHaveBeenCalledWith(expectedMatchRequest);
        });

        it("should override both confidence and search region with parameter.", async () => {
            // GIVEN
            const minMatch = 0.8;
            const customSearchRegion = new Region(10, 10, 90, 90);
            const matchResult = new MatchResult(minMatch, searchRegion);
            const findMatchMock = jest.fn(() => Promise.resolve(matchResult));
            providerRegistryMock.getImageFinder = jest.fn(() => mockPartial<ImageFinderInterface>({
                findMatch: findMatchMock
            }));

            const SUT = new ScreenClass(providerRegistryMock);
            const needle = new Image(100, 100, Buffer.from([]), 3);
            const parameters = new LocationParameters(customSearchRegion, minMatch);
            const expectedMatchRequest = new MatchRequest(
                expect.any(Image),
                needle,
                minMatch,
                true);

            // WHEN
            await SUT.find(needle, parameters);

            // THEN
            expect(findMatchMock).toHaveBeenCalledWith(expectedMatchRequest);
        });

        it("should add search region offset to result image location", async () => {
            // GIVEN
            const limitedSearchRegion = new Region(100, 200, 300, 400);
            const resultRegion = new Region(50, 100, 150, 200);
            const matchResult = new MatchResult(0.99, resultRegion);

            const expectedMatchRegion = new Region(
                limitedSearchRegion.left + resultRegion.left,
                limitedSearchRegion.top + resultRegion.top,
                resultRegion.width,
                resultRegion.height);

            const findMatchMock = jest.fn(() => Promise.resolve(matchResult));
            providerRegistryMock.getImageFinder = jest.fn(() => mockPartial<ImageFinderInterface>({
                findMatch: findMatchMock
            }));

            const SUT = new ScreenClass(providerRegistryMock);
            // WHEN
            const matchRegion = await SUT.find(
                new Image(100, 100, Buffer.from([]), 3),
                {
                    searchRegion: limitedSearchRegion
                }
            );

            // THEN
            expect(matchRegion).toEqual(expectedMatchRegion);
        })

        it.each([
            ["with negative x coordinate", new Region(-1, 0, 100, 100)],
            ["with negative y coordinate", new Region(0, -1, 100, 100)],
            ["with negative width", new Region(0, 0, -100, 100)],
            ["with negative height", new Region(0, 0, 100, -100)],
            ["with region outside screen on x axis", new Region(1100, 0, 100, 100)],
            ["with region outside screen on y axis", new Region(0, 1100, 100, 100)],
            ["with region bigger than screen on x axis", new Region(0, 0, 1100, 100)],
            ["with region bigger than screen on y axis", new Region(0, 0, 1000, 1100)],
            ["with region of 1 px width", new Region(0, 0, 1, 1100)],
            ["with region of 1 px height", new Region(0, 0, 100, 1)],
            ["with region leaving screen on x axis", new Region(600, 0, 500, 100)],
            ["with region leaving screen on y axis", new Region(0, 500, 100, 600)],
            ["with NaN x coordinate", new Region("a" as unknown as number, 0, 100, 100)],
            ["with NaN y coordinate", new Region(0, "a" as unknown as number, 100, 600)],
            ["with NaN on width", new Region(0, 0, "a" as unknown as number, 100)],
            ["with NaN on height", new Region(0, 0, 100, "a" as unknown as number)],
        ])("should reject search regions %s", async (_, region) => {
            // GIVEN
            const needle = new Image(100, 100, Buffer.from([]), 3);
            const matchResult = new MatchResult(0.99, region);
            const findMatchMock = jest.fn(() => Promise.resolve(matchResult));
            providerRegistryMock.getImageFinder = jest.fn(() => mockPartial<ImageFinderInterface>({
                findMatch: findMatchMock
            }));

            const SUT = new ScreenClass(providerRegistryMock);

            // WHEN
            const findPromise = SUT.find(
                needle,
                {
                    searchRegion: region
                });

            // THEN
            await expect(findPromise).rejects.toContain(`Searching for image failed. Reason:`);
        })
    });

    it("should return region to highlight for chaining", async () => {
        // GIVEN
        const highlightRegion = new Region(10, 20, 30, 40);
        const highlightMock = jest.fn((value: any) => Promise.resolve(value));
        providerRegistryMock.getScreen = jest.fn(() => mockPartial<ScreenProviderInterface>({
            highlightScreenRegion: highlightMock
        }));

        const SUT = new ScreenClass(providerRegistryMock);
        // WHEN
        const result = await SUT.highlight(highlightRegion);

        // THEN
        expect(result).toEqual(highlightRegion);
    });

    it("should handle Promises and return region to highlight for chaining", async () => {
        // GIVEN
        const highlightRegion = new Region(10, 20, 30, 40);
        const highlightRegionPromise = new Promise<Region>(res => res(highlightRegion));
        const highlightMock = jest.fn((value: any) => Promise.resolve(value));
        providerRegistryMock.getScreen = jest.fn(() => mockPartial<ScreenProviderInterface>({
            highlightScreenRegion: highlightMock
        }));

        const SUT = new ScreenClass(providerRegistryMock);

        // WHEN
        const result = await SUT.highlight(highlightRegionPromise);

        // THEN
        expect(result).toEqual(highlightRegion);
    });

    describe("capture", () => {
        it("should capture the whole screen and save image", async () => {
            // GIVEN
            const screenshot = mockPartial<Image>({data: "pretty pretty image"});
            const grabScreenMock = jest.fn(() => Promise.resolve(screenshot));
            const saveImageMock = jest.fn();
            providerRegistryMock.getScreen = jest.fn(() => mockPartial<ScreenProviderInterface>({
                grabScreen: grabScreenMock
            }));
            providerRegistryMock.getImageWriter = jest.fn(() => mockPartial<ImageWriter>({
                store: saveImageMock
            }));

            const SUT = new ScreenClass(providerRegistryMock);
            const imageName = "foobar.png"
            const expectedImagePath = join(cwd(), imageName)

            // WHEN
            const imagePath = await SUT.capture(imageName)

            // THEN
            expect(imagePath).toBe(expectedImagePath)
            expect(grabScreenMock).toHaveBeenCalled()
            expect(saveImageMock).toHaveBeenCalledWith({data: screenshot, path: expectedImagePath})
        });
    })

    describe("captureRegion", () => {
        it("should capture the specified region of the screen and save image", async () => {
            // GIVEN
            const screenshot = mockPartial<Image>({data: "pretty partial image"});
            const regionToCapture = mockPartial<Region>({top: 42, left: 9, height: 10, width: 3.14159265359})
            const grabScreenMock = jest.fn(() => Promise.resolve(screenshot));
            const saveImageMock = jest.fn();
            providerRegistryMock.getScreen = jest.fn(() => mockPartial<ScreenProviderInterface>({
                grabScreenRegion: grabScreenMock
            }));
            providerRegistryMock.getImageWriter = jest.fn(() => mockPartial<ImageWriter>({
                store: saveImageMock
            }));

            const SUT = new ScreenClass(providerRegistryMock);
            const imageName = "foobar.png"
            const expectedImagePath = join(cwd(), imageName)

            // WHEN
            const imagePath = await SUT.captureRegion(imageName, regionToCapture)

            // THEN
            expect(imagePath).toBe(expectedImagePath)
            expect(grabScreenMock).toHaveBeenCalledWith(regionToCapture)
            expect(saveImageMock).toHaveBeenCalledWith({data: screenshot, path: expectedImagePath})
        });
    });
});
