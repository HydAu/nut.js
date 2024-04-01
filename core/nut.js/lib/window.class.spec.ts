import { Window } from "./window.class";
import {
  ElementInspectionProviderInterface,
  LogProviderInterface,
  ProviderRegistry,
  ScreenProviderInterface,
  WindowProviderInterface
} from "@nut-tree/provider-interfaces";
import { mockPartial } from "sneer";
import { Region, WindowElement, WindowElementDescription } from "@nut-tree/shared";
import { windowElementDescribedBy } from "../index";
import { NoopLogProvider } from "./provider/log/noop-log-provider.class";

describe("Window class", () => {
  it("should retrieve the window region via provider", async () => {
    // GIVEN
    const windowMock = jest.fn(() => {
      return Promise.resolve(new Region(10, 10, 100, 100));
    });
    const providerRegistryMock = mockPartial<ProviderRegistry>({
      getWindow(): WindowProviderInterface {
        return mockPartial<WindowProviderInterface>({
          getWindowRegion: windowMock
        });
      },
      getScreen(): ScreenProviderInterface {
        return mockPartial<ScreenProviderInterface>({
          screenSize(): Promise<Region> {
            return Promise.resolve(new Region(0, 0, 1920, 1080));
          }
        });
      }
    });
    const mockWindowHandle = 123;
    const SUT = new Window(providerRegistryMock, mockWindowHandle);

    // WHEN
    await SUT.getRegion();

    // THEN
    expect(windowMock).toHaveBeenCalledTimes(1);
    expect(windowMock).toHaveBeenCalledWith(mockWindowHandle);
  });

  it("should retrieve the window title via provider", async () => {
    // GIVEN
    const windowMock = jest.fn();
    const providerRegistryMock = mockPartial<ProviderRegistry>({
      getWindow(): WindowProviderInterface {
        return mockPartial<WindowProviderInterface>({
          getWindowTitle: windowMock
        });
      }
    });
    const mockWindowHandle = 123;
    const SUT = new Window(providerRegistryMock, mockWindowHandle);

    // WHEN
    await SUT.getTitle();

    // THEN
    expect(windowMock).toHaveBeenCalledTimes(1);
    expect(windowMock).toHaveBeenCalledWith(mockWindowHandle);
  });

  describe("element-inspection", () => {
    it("should retrieve the window elements via provider", async () => {
      // GIVEN
      const elementInspectorMock = jest.fn();
      const providerRegistryMock = mockPartial<ProviderRegistry>({
        getWindowElementInspector(): ElementInspectionProviderInterface {
          return mockPartial<ElementInspectionProviderInterface>({
            getElements: elementInspectorMock
          });
        }
      });
      const mockWindowHandle = 123;
      const maxElements = 1000;
      const SUT = new Window(providerRegistryMock, mockWindowHandle);

      // WHEN
      await SUT.getElements(maxElements);

      // THEN
      expect(elementInspectorMock).toHaveBeenCalledTimes(1);
      expect(elementInspectorMock).toHaveBeenCalledWith(mockWindowHandle, maxElements);
    });

    it("should search for window elements via provider", async () => {
      // GIVEN
      const elementInspectorMock = jest.fn();
      const providerRegistryMock = mockPartial<ProviderRegistry>({
        getWindowElementInspector(): ElementInspectionProviderInterface {
          return mockPartial<ElementInspectionProviderInterface>({
            findElement: elementInspectorMock,
            findElements: elementInspectorMock
          });
        },
        getLogProvider(): LogProviderInterface {
          return new NoopLogProvider();
        }
      });
      const mockWindowHandle = 123;
      const description: WindowElementDescription = {
        type: "test"
      };
      const SUT = new Window(providerRegistryMock, mockWindowHandle);

      // WHEN
      await SUT.find(windowElementDescribedBy(description));

      // THEN
      expect(elementInspectorMock).toHaveBeenCalledTimes(1);
      expect(elementInspectorMock).toHaveBeenCalledWith(mockWindowHandle, description);
    });

    it("should search for multiple elements via provider", async () => {
      // GIVEN
      const elementInspectorMock = jest.fn();
      const providerRegistryMock = mockPartial<ProviderRegistry>({
        getWindowElementInspector(): ElementInspectionProviderInterface {
          return mockPartial<ElementInspectionProviderInterface>({
            findElement: elementInspectorMock,
            findElements: elementInspectorMock
          });
        },
        getLogProvider(): LogProviderInterface {
          return new NoopLogProvider();
        }
      });
      const mockWindowHandle = 123;
      const description: WindowElementDescription = {
        type: "test"
      };
      const SUT = new Window(providerRegistryMock, mockWindowHandle);

      // WHEN
      await SUT.findAll(windowElementDescribedBy(description));

      // THEN
      expect(elementInspectorMock).toHaveBeenCalledTimes(1);
      expect(elementInspectorMock).toHaveBeenCalledWith(mockWindowHandle, description);
    });

    describe("hooks", () => {
      it("should trigger registered hooks", async () => {
        // GIVEN
        const windowElementType = { type: "testElement" };
        const windowElement = mockPartial<WindowElement>(windowElementType);
        const hookMock = jest.fn();
        const elementInspectorMock = jest.fn(() => Promise.resolve(windowElement));
        const secondHookMock = jest.fn();
        const providerRegistryMock = mockPartial<ProviderRegistry>({
          getWindowElementInspector(): ElementInspectionProviderInterface {
            return mockPartial<ElementInspectionProviderInterface>({
              findElement: elementInspectorMock
            });
          },
          getLogProvider(): LogProviderInterface {
            return new NoopLogProvider();
          }
        });
        const mockWindowHandle = 123;
        const description: WindowElementDescription = {
          type: "test"
        };
        const query = windowElementDescribedBy(description);
        const SUT = new Window(providerRegistryMock, mockWindowHandle);
        SUT.on(query, hookMock);
        SUT.on(query, secondHookMock);

        // WHEN
        await SUT.find(query);

        // THEN
        expect(elementInspectorMock).toHaveBeenCalledTimes(1);
        expect(elementInspectorMock).toHaveBeenCalledWith(mockWindowHandle, description);
        expect(hookMock).toHaveBeenCalledTimes(1);
        expect(hookMock).toHaveBeenCalledWith(windowElement);
        expect(secondHookMock).toHaveBeenCalledTimes(1);
        expect(secondHookMock).toHaveBeenCalledWith(windowElement);
      });

      it("should trigger registered hooks for all matches", async () => {
        // GIVEN
        const windowElementType = { type: "testElement" };
        const secondElementType = { type: "secondElement" };
        const windowElement = mockPartial<WindowElement>(windowElementType);
        const secondElement = mockPartial<WindowElement>(secondElementType);
        const mockMatches = [windowElement, secondElement];
        const hookMock = jest.fn();
        const elementInspectorMock = jest.fn(() => Promise.resolve(mockMatches));
        const secondHookMock = jest.fn();
        const providerRegistryMock = mockPartial<ProviderRegistry>({
          getWindowElementInspector(): ElementInspectionProviderInterface {
            return mockPartial<ElementInspectionProviderInterface>({
              findElements: elementInspectorMock
            });
          },
          getLogProvider(): LogProviderInterface {
            return new NoopLogProvider();
          }
        });
        const mockWindowHandle = 123;
        const description: WindowElementDescription = {
          type: "test"
        };
        const query = windowElementDescribedBy(description);
        const SUT = new Window(providerRegistryMock, mockWindowHandle);
        SUT.on(query, hookMock);
        SUT.on(query, secondHookMock);

        // WHEN
        await SUT.findAll(query);

        // THEN
        expect(elementInspectorMock).toHaveBeenCalledTimes(1);
        expect(elementInspectorMock).toHaveBeenCalledWith(mockWindowHandle, description);
        expect(hookMock).toHaveBeenCalledTimes(mockMatches.length);
        expect(hookMock).toHaveBeenCalledWith(windowElement);
        expect(hookMock).toHaveBeenCalledWith(secondElement);
        expect(secondHookMock).toHaveBeenCalledTimes(mockMatches.length);
        expect(secondHookMock).toHaveBeenCalledWith(secondElement);
      });
    });
  });
});
