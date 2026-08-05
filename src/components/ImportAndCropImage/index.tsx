import { getCroppedImageData } from '../../lib'
import { ImageAssetPipeline, isAnimatedWebP } from '../../lib/assets'
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'

import { Area } from 'react-easy-crop/types'

import Cropper from 'react-easy-crop'
import { Button, Slider } from 'antd'

import styles from './styles.module.less'
import {
  BorderInnerOutlined,
  ImportOutlined
} from '@ant-design/icons'

export enum IMPORT_IMAGE_TYPE {
  INLINE = 'INLINE'
}

export interface CroppedImage {
  type?: IMPORT_IMAGE_TYPE
  data: Blob | null
  url: string
}

const ImportAndCropImage = React.forwardRef<
  { import: (type?: IMPORT_IMAGE_TYPE) => void },
  {
    cropping: boolean
    showGrid?: boolean
    cropAreaStyle?: React.CSSProperties
    containerStyle?: React.CSSProperties
    // the crop stage is declared 16:9 in this component's stylesheet, which suits
    // the event image slot it was written for and nothing else
    cropContainerStyle?: React.CSSProperties
    controlStyle?: React.CSSProperties
    aspectRatio?: number
    size: { width: number; height: number }
    // what the file is encoded as on save. Defaults to webp, which is what the
    // event content image slot has always written; character masks are jpeg.
    format?: ImageAssetPipeline['format']
    quality?: number
    // When set, an imported animated WebP bypasses the cropper and is stored as
    // its original bytes — a canvas re-encode would keep only the first frame. Off
    // for kinds whose display is a fixed shape (a character mask) or a still.
    allowAnimation?: boolean
    onImportImageData: () => void
    onImportImageCropComplete: (image: CroppedImage | null) => void
    onSelectNewImage: () => void
  }
>(
  (
    {
      cropping,
      showGrid,
      cropAreaStyle,
      containerStyle,
      cropContainerStyle,
      controlStyle,
      aspectRatio,
      size,
      format,
      quality,
      allowAnimation,
      onImportImageData,
      onImportImageCropComplete,
      onSelectNewImage
    },
    ref
  ) => {
    const importImageInputRef = useRef<HTMLInputElement>(null)

    const [imageType, setImageType] = useState<IMPORT_IMAGE_TYPE | null>(null),
      [imageData, setImageData] = useState<string | ArrayBuffer | null>(null),
      [crop, setCrop] = useState({ x: 0, y: 0 }),
      [zoom, setZoom] = useState(1),
      [gridEnabled, setGridEnabled] = useState(false),
      [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

    const onMaskImageSelect = async (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      if (event.target.files && event.target.files.length > 0) {
        const maskImage = event.target.files[0]

        // An animated WebP cannot survive the cropper's canvas re-encode, so it
        // skips it and is stored as its original bytes. The slot displays it with
        // object-fit, so an uncropped shape still fits. Detected from the file's
        // own bytes rather than its extension.
        if (allowAnimation && isAnimatedWebP(await maskImage.arrayBuffer())) {
          onImportImageCropComplete({
            type: imageType || undefined,
            data: maskImage,
            url: URL.createObjectURL(maskImage)
          })

          resetState()

          return
        }

        const reader = new FileReader()

        reader.addEventListener(
          'load',
          () => {
            setImageData(reader.result)
          },
          false
        )

        reader.readAsDataURL(maskImage)
      }
    }

    const onSave = useCallback(async () => {
      if (imageData && croppedAreaPixels) {
        const croppedImageData = await getCroppedImageData(
          imageData as string,
          croppedAreaPixels,
          size,
          format || 'webp',
          quality
        )

        croppedImageData &&
          onImportImageCropComplete({
            type: imageType || undefined,
            ...croppedImageData
          })
      }
    }, [imageType, imageData, croppedAreaPixels, size, format, quality])

    const resetState = () => {
      if (importImageInputRef.current) importImageInputRef.current.value = ''

      setImageType(null)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setImageData(null)
    }

    useImperativeHandle(ref, () => ({
      import: (type) => {
        setImageType(type || null)

        importImageInputRef.current?.click()
      }
    }))

    useEffect(() => {
      if (imageData) {
        setCrop({ x: 0, y: 0 })
        setZoom(1)

        onImportImageData()
      }
    }, [imageData])

    useEffect(() => {
      // TODO: hack; hook into transition complete
      !cropping && setTimeout(resetState, 300)
    }, [cropping])

    return (
      <>
        <input
          ref={importImageInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={onMaskImageSelect}
        />

        <div
          className={`${styles.ImportAndCropImage} ${
            cropping && imageData ? styles.cropping : ''
          }`}
        >
          <>
            {imageType && <h1>{imageType}</h1>}

            {imageData && (
              <>
                <div
                  className={styles.cropContainer}
                  style={{ ...cropContainerStyle }}
                >
                  {/*
                    The stage is sized to the crop's own aspect so the crop box
                    fills it, rather than being a square inscribed in a wide
                    rectangle with dark bands either side.

                    That is not cosmetic. `objectFit` fits the image to the
                    *container*, not to the crop box, so a container wider than the
                    crop box makes the image larger than the crop box before any
                    zoom is applied — which is how a 1:1 crop of a 256px image ended
                    up showing a quarter of it at minimum zoom.
                  */}
                  <div
                    className={styles.cropStage}
                    style={
                      aspectRatio
                        ? { aspectRatio: `${aspectRatio}` }
                        : undefined
                    }
                  >
                    <Cropper
                      style={{
                        cropAreaStyle: {
                          color: 'hsla(0, 0%, 0%, 0.9)',
                          ...cropAreaStyle
                        },
                        containerStyle: {
                          ...containerStyle
                        }
                      }}
                      image={imageData as string}
                      showGrid={showGrid || gridEnabled}
                      crop={crop}
                      zoom={zoom}
                      // cropSize={size}
                      aspect={aspectRatio}
                      onCropChange={setCrop}
                      /*
                       * `contain`, which is also the library's own default. It was
                       * `horizontal-cover`, whose stylesheet rule is `width: 100%`
                       * of the container — so the image was stretched to the stage's
                       * full width regardless of its shape, and the slider's floor of
                       * 1 meant that magnification could only be increased. A square
                       * 256px source opened at roughly 4x with no way back.
                       *
                       * With `contain` the whole image is visible at zoom 1 and the
                       * slider only ever crops in, which is the direction that makes
                       * sense. An image smaller than the crop box stays small rather
                       * than being upscaled by default; zooming up to fill is the
                       * author's choice, and where the aspects differ a saved image
                       * keeps whatever is outside the picture as transparent — black,
                       * for a jpeg character mask.
                       */
                      objectFit="contain"
                      // onCropChange={(location) => {
                      //   setCrop({
                      //     x: location.x < 0 ? 0 : location.x,
                      //     y: location.y < 0 ? 0 : location.y
                      //   })
                      // }}
                      onCropComplete={(_, croppedAreaPixels) =>
                        setCroppedAreaPixels(croppedAreaPixels)
                      }
                      onZoomChange={setZoom}
                    />
                  </div>
                </div>

                <div className={styles.controls} style={{ ...controlStyle }}>
                  <Slider
                    min={1}
                    max={3}
                    step={0.05}
                    tooltipVisible={false}
                    onChange={(value) => setZoom(value)}
                    value={zoom}
                    className={styles.slider}
                  />

                  <div className={styles.buttons}>
                    <Button
                      className={styles.side}
                      onClick={() => setGridEnabled(!gridEnabled)}
                      title={gridEnabled ? 'Disable grid' : 'Enable grid'}
                    >
                      <BorderInnerOutlined
                        className={gridEnabled ? styles.enabled : ''}
                      />
                    </Button>

                    <div className={styles.middle}>
                      <Button onClick={() => onImportImageCropComplete(null)}>
                        Cancel
                      </Button>

                      <Button
                        onClick={onSave}
                        className={styles.save}
                        type="primary"
                      >
                        Save
                      </Button>
                    </div>

                    <Button
                      className={styles.side}
                      title="Replace image"
                      onClick={onSelectNewImage}
                    >
                      <ImportOutlined />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        </div>
      </>
    )
  }
)

ImportAndCropImage.displayName = 'ImportAndCropImage'

export default ImportAndCropImage
