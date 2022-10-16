import {cwd} from "process";
import {FileType} from "./file-type.enum";
import {generateOutputPath} from "./generate-output-path.function";
import {MatchRequest} from "./match-request.class";
import {MatchResult} from "./match-result.class";
import {isRegion, Region} from "./region.class";
import {timeout} from "./util/timeout.function";
import {Image, isImage} from "./image.class";
import {ProviderRegistry} from "./provider/provider-registry.class";
import {FirstArgumentType} from "./typings";
import {isPoint, Point} from "./point.class";
import {OptionalSearchParameters} from "./optionalsearchparameters.class";

export type FindHookCallback = (target: MatchResult) => Promise<void>;

function validateSearchRegion(search: Region, screen: Region) {
    if (search.left < 0 || search.top < 0 || search.width < 0 || search.height < 0) {
        throw new Error(`Negative values in search region ${search}`)
    }
    if (isNaN(search.left) || isNaN(search.top) || isNaN(search.width) || isNaN(search.height)) {
        throw new Error(`NaN values in search region ${search}`)
    }
    if (search.width < 2 || search.height < 2) {
        throw new Error(`Search region ${search} is not large enough. Must be at least two pixels in both width and height.`)
    }
    if (search.left + search.width > screen.width || search.top + search.height > screen.height) {
        throw new Error(`Search region ${search} extends beyond screen boundaries (${screen.width}x${screen.height})`)
    }
}

/**
 * {@link ScreenClass} class provides methods to access screen content of a systems main display
 */
export class ScreenClass {

    /**
     * Config object for {@link ScreenClass} class
     */
    public config = {
        /**
         * Configures the required matching percentage for template images to be declared as a match
         */
        confidence: 0.99,

        /**
         * Configure whether to auto highlight all search results or not
         */
        autoHighlight: false,
        /**
         * Configure highlighting duration
         */
        highlightDurationMs: 500,

        /**
         * Configure opacity of highlight window
         */
        highlightOpacity: 0.25,

        /**
         * Configures the path from which template images are loaded from
         */
        resourceDirectory: cwd(),
    };

    /**
     * {@link ScreenClass} class constructor
     * @param providerRegistry A {@link ProviderRegistry} used to access underlying implementations
     * @param findHooks A {@link Map} of {@link FindHookCallback} methods assigned to a template image
     */
    constructor(
        private providerRegistry: ProviderRegistry,
        private findHooks: Map<Image, FindHookCallback[]> = new Map<Image, FindHookCallback[]>()) {
    }

    /**
     * {@link width} returns the main screen width
     * This refers to the hardware resolution.
     * Screens with higher pixel density (e.g. retina displays in MacBooks) might have a higher width in in actual pixels
     */
    public width() {
        this.providerRegistry.getLogProvider().debug(`Fetching screen width`);
        return this.providerRegistry.getScreen().screenWidth();
    }

    /**
     * {@link height} returns the main screen height
     * This refers to the hardware resolution.
     * Screens with higher pixel density (e.g. retina displays in MacBooks) might have a higher height in in actual pixels
     */
    public height() {
        this.providerRegistry.getLogProvider().debug(`Fetching screen height`);
        return this.providerRegistry.getScreen().screenHeight();
    }

    /**
     * {@link find} will search for a single occurrence of a template image on a systems main screen
     * @param template Template {@link Image} instance
     * @param params {@link LocationParameters} which are used to fine tune search region and / or match confidence
     */
    public async find(
        template: Image | Promise<Image>,
        params?: OptionalSearchParameters,
    ): Promise<Region> {
        const {
            minMatch,
            screenSize,
            searchRegion,
            screenImage,
            searchMultipleScales
        } = await this.getFindParameters(params);

        const needle = await ScreenClass.getNeedle(template);
        this.providerRegistry.getLogProvider().info(`Searching for image ${needle.id} in region ${searchRegion.toString()} ${searchMultipleScales ? 'over multiple scales' : 'without scaling'}. Required confidence: ${minMatch}`);

        const matchRequest = new MatchRequest(
            screenImage,
            needle,
            minMatch,
            searchMultipleScales
        );

        return new Promise<Region>(async (resolve, reject) => {
            try {
                validateSearchRegion(searchRegion, screenSize);
                this.providerRegistry.getLogProvider().debug(`Search region is valid`);
                const matchResult = await this.providerRegistry.getImageFinder().findMatch(matchRequest);
                const possibleHooks = this.findHooks.get(needle) || [];
                this.providerRegistry.getLogProvider().debug(`${possibleHooks.length} hooks triggered for match`);
                for (const hook of possibleHooks) {
                    this.providerRegistry.getLogProvider().debug(`Executing hook`);
                    await hook(matchResult);
                }
                const resultRegion = new Region(
                    searchRegion.left + matchResult.location.left,
                    searchRegion.top + matchResult.location.top,
                    matchResult.location.width,
                    matchResult.location.height
                )
                this.providerRegistry.getLogProvider().info(`Match is located at ${resultRegion.toString()}`);
                if (this.config.autoHighlight) {
                    this.providerRegistry.getLogProvider().debug(`Autohighlight is enabled`);
                    resolve(this.highlight(resultRegion));
                } else {
                    resolve(resultRegion);
                }
            } catch (e) {
                reject(
                    `Searching for ${needle.id} failed. Reason: '${e}'`,
                );
            }
        });
    }

    /**
     * {@link findAll} will search for every occurrences of a template image on a systems main screen
     * @param template Template {@link Image} instance
     * @param params {@link LocationParameters} which are used to fine tune search region and / or match confidence
     */
    public async findAll(
        template: FirstArgumentType<typeof ScreenClass.prototype.find>,
        params?: OptionalSearchParameters,
    ): Promise<Region[]> {
        const {
            minMatch,
            screenSize,
            searchRegion,
            screenImage,
            searchMultipleScales
        } = await this.getFindParameters(params);

        const needle = await ScreenClass.getNeedle(template);
        this.providerRegistry.getLogProvider().info(`Searching for image ${needle.id} in region ${searchRegion.toString()} ${searchMultipleScales ? 'over multiple scales' : 'without scaling'}. Required confidence: ${minMatch}`);

        const matchRequest = new MatchRequest(
            screenImage,
            needle,
            minMatch,
            searchMultipleScales
        );

        return new Promise<Region[]>(async (resolve, reject) => {
            try {
                validateSearchRegion(searchRegion, screenSize);
                this.providerRegistry.getLogProvider().debug(`Search region is valid`);
                const matchResults = await this.providerRegistry.getImageFinder().findMatches(matchRequest);
                const possibleHooks = this.findHooks.get(needle) || [];
                this.providerRegistry.getLogProvider().debug(`${possibleHooks.length} hooks triggered for ${matchResults.length} matches`);
                for (const hook of possibleHooks) {
                    for (const matchResult of matchResults) {
                        this.providerRegistry.getLogProvider().debug(`Executing hook`);
                        await hook(matchResult);
                    }
                }
                const resultRegions = matchResults.map(matchResult => {
                    const resultRegion = new Region(
                        searchRegion.left + matchResult.location.left,
                        searchRegion.top + matchResult.location.top,
                        matchResult.location.width,
                        matchResult.location.height
                    )
                    this.providerRegistry.getLogProvider().info(`Match is located at ${resultRegion.toString()}`);
                    return resultRegion;
                })
                if (this.config.autoHighlight) {
                    this.providerRegistry.getLogProvider().debug(`Autohighlight is enabled`);
                    resultRegions.forEach(region => this.highlight(region));
                    resolve(resultRegions);
                } else {
                    resolve(resultRegions);
                }
            } catch (e) {
                reject(
                    `Searching for ${needle.id} failed. Reason: '${e}'`,
                );
            }
        });
    }

    /**
     * {@link highlight} highlights a screen {@link Region} for a certain duration by overlaying it with an opaque highlight window
     * @param regionToHighlight The {@link Region} to highlight
     */
    public async highlight(regionToHighlight: Region | Promise<Region>): Promise<Region> {
        const highlightRegion = await regionToHighlight;
        this.providerRegistry.getLogProvider().info(`Highlighting ${highlightRegion.toString()} for ${this.config.highlightDurationMs / 1000} with ${this.config.highlightOpacity * 100}% opacity`);
        await this.providerRegistry.getScreen().highlightScreenRegion(highlightRegion, this.config.highlightDurationMs, this.config.highlightOpacity);
        return highlightRegion;
    }

    /**
     * {@link waitFor} searches for a template image for a specified duration
     * @param templateImage Filename of the template image, relative to {@link ScreenClass.config.resourceDirectory}, or an {@link Image}
     * @param timeoutMs Timeout in milliseconds after which {@link waitFor} fails
     * @param updateInterval Update interval in milliseconds to retry search
     * @param params {@link LocationParameters} which are used to fine tune search region and / or match confidence
     */
    public async waitFor(
        templateImage: FirstArgumentType<typeof ScreenClass.prototype.find>,
        timeoutMs: number = 5000,
        updateInterval: number = 500,
        params?: OptionalSearchParameters,
    ): Promise<Region> {
        const needle = await templateImage;

        if (!isImage(needle)) {
            throw Error(`waitFor requires an Image, but received ${JSON.stringify(templateImage)}`)
        }
        this.providerRegistry.getLogProvider().info(`Waiting for image ${needle.id} to appear on screen. Timeout: ${timeoutMs / 1000} seconds, interval: ${updateInterval} ms`);
        return timeout(updateInterval, timeoutMs, () => this.find(needle, params), {signal: params?.abort});
    }

    /**
     * {@link on} registers a callback which is triggered once a certain template image is found
     * @param templateImage Template image to trigger the callback on
     * @param callback The {@link FindHookCallback} function to trigger
     */
    public on(templateImage: Image, callback: FindHookCallback) {
        if (!isImage(templateImage)) {
            throw Error(`on requires an Image, but received ${JSON.stringify(templateImage)}`)
        }
        const existingHooks = this.findHooks.get(templateImage) || [];
        this.findHooks.set(templateImage, [...existingHooks, callback]);
        this.providerRegistry.getLogProvider().info(`Registered callback for image ${templateImage.id}. There are currently ${existingHooks.length + 1} hooks registered`);
    }

    /**
     * {@link capture} captures a screenshot of a systems main display
     * @param fileName Basename for the generated screenshot
     * @param fileFormat The {@link FileType} for the generated screenshot
     * @param filePath The output path for the generated screenshot (Default: {@link cwd})
     * @param fileNamePrefix Filename prefix for the generated screenshot (Default: empty)
     * @param fileNamePostfix Filename postfix for the generated screenshot (Default: empty)
     */
    public async capture(
        fileName: string,
        fileFormat: FileType = FileType.PNG,
        filePath: string = cwd(),
        fileNamePrefix: string = "",
        fileNamePostfix: string = ""): Promise<string> {
        const currentScreen = await this.providerRegistry.getScreen().grabScreen();
        if (!isImage(currentScreen)) {
            throw Error(`capture requires an Image, but received ${JSON.stringify(currentScreen)}`)
        }
        return this.saveImage(
            currentScreen,
            fileName,
            fileFormat,
            filePath,
            fileNamePrefix,
            fileNamePostfix);
    }

    /**
     * {@link grab} grabs screen content of a systems main display
     */
    public async grab(): Promise<Image> {
        return this.providerRegistry.getScreen().grabScreen();
    }

    /**
     * {@link captureRegion} captures a screenshot of a region on the systems main display
     * @param fileName Basename for the generated screenshot
     * @param regionToCapture The region of the screen to capture in the screenshot
     * @param fileFormat The {@link FileType} for the generated screenshot
     * @param filePath The output path for the generated screenshot (Default: {@link cwd})
     * @param fileNamePrefix Filename prefix for the generated screenshot (Default: empty)
     * @param fileNamePostfix Filename postfix for the generated screenshot (Default: empty)
     */
    public async captureRegion(
        fileName: string,
        regionToCapture: Region | Promise<Region>,
        fileFormat: FileType = FileType.PNG,
        filePath: string = cwd(),
        fileNamePrefix: string = "",
        fileNamePostfix: string = ""): Promise<string> {
        const targetRegion = await regionToCapture;
        if (!isRegion(targetRegion)) {
            throw Error(`captureRegion requires an Region, but received ${JSON.stringify(targetRegion)}`)
        }
        const regionImage = await this.providerRegistry.getScreen().grabScreenRegion(targetRegion);
        if (!isImage(regionImage)) {
            throw Error(`captureRegion requires an Image, but received ${JSON.stringify(regionImage)}`)
        }
        return this.saveImage(
            regionImage,
            fileName,
            fileFormat,
            filePath,
            fileNamePrefix,
            fileNamePostfix);
    }

    /**
     * {@link grabRegion} grabs screen content of a region on the systems main display
     * @param regionToGrab The screen region to grab
     */
    public async grabRegion(regionToGrab: Region | Promise<Region>): Promise<Image> {
        return this.providerRegistry.getScreen().grabScreenRegion(await regionToGrab);
    }

    /**
     * {@link colorAt} returns RGBA color values for a certain pixel at {@link Point} p
     * @param point Location to query color information from
     */
    public async colorAt(point: Point | Promise<Point>) {
        const screenContent = await this.providerRegistry.getScreen().grabScreen();
        const inputPoint = await point;
        if (!isPoint(inputPoint)) {
            throw Error(`colorAt requires a Point, but received ${JSON.stringify(inputPoint)}`)
        }
        const scaledPoint = new Point(inputPoint.x * screenContent.pixelDensity.scaleX, inputPoint.y * screenContent.pixelDensity.scaleY);
        return this.providerRegistry.getImageProcessor().colorAt(screenContent, scaledPoint);
    }

    private async saveImage(
        image: Image,
        fileName: string,
        fileFormat: FileType,
        filePath: string,
        fileNamePrefix: string,
        fileNamePostfix: string) {
        const outputPath = generateOutputPath(fileName, {
            path: filePath,
            postfix: fileNamePostfix,
            prefix: fileNamePrefix,
            type: fileFormat,
        });
        await this.providerRegistry.getImageWriter().store({image, path: outputPath})
        return outputPath;
    }

    private async getFindParameters(params?: OptionalSearchParameters) {
        const minMatch = params?.confidence ?? this.config.confidence;
        const screenSize = await this.providerRegistry.getScreen().screenSize();
        const searchRegion = params?.searchRegion ?? screenSize;
        const screenImage = await this.providerRegistry.getScreen().grabScreenRegion(searchRegion);
        const searchMultipleScales = params?.searchMultipleScales ?? true;

        return ({
            minMatch,
            screenSize,
            searchRegion,
            screenImage,
            searchMultipleScales
        });
    }

    private static async getNeedle(template: FirstArgumentType<typeof ScreenClass.prototype.find>) {
        const needle = await template;

        if (!isImage(needle)) {
            throw Error(`find requires an Image, but received ${JSON.stringify(needle)}`)
        }
        return needle;
    }
}
