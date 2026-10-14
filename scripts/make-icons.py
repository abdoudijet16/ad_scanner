"""Generates the app icon (assets/ + www/icon-*.png + Android mipmaps). Run: python3 scripts/make-icons.py"""
from PIL import Image, ImageDraw
import os
S=1024; SS=2
def doc_layer(size=S, scale=1.0):
    """Transparent layer: white document + scan beam + corner brackets, drawn inside the adaptive-icon safe zone."""
    k=SS; N=size*k; im=Image.new('RGBA',(N,N),(0,0,0,0)); d=ImageDraw.Draw(im)
    c=N/2; u=N/1024*scale
    def P(x,y): return (c+(x-512)*u, c+(y-512)*u)
    # paper with folded corner
    x0,y0,x1,y1,f=312,222,712,802,110
    pts=[P(x0,y0),P(x1-f,y0),P(x1,y0+f),P(x1,y1),P(x0,y1)]
    sh=Image.new('RGBA',(N,N),(0,0,0,0)); ImageDraw.Draw(sh).polygon([(a+8*u,b+14*u) for a,b in pts],fill=(0,0,40,70)); im=Image.alpha_composite(im,sh); d=ImageDraw.Draw(im)
    d.polygon(pts,fill=(255,255,255,255))
    d.polygon([P(x1-f,y0),P(x1,y0+f),P(x1-f,y0+f)],fill=(203,213,235,255))
    # text lines
    for i,w in enumerate([300,300,300,200]):
        yy=360+i*62; d.rounded_rectangle([*P(362,yy),*P(362+w,yy+26)],radius=13*u,fill=(148,163,196,255))
    # scan beam
    d.rounded_rectangle([*P(262,596),*P(762,624)],radius=14*u,fill=(34,211,238,255))
    glow=Image.new('RGBA',(N,N),(0,0,0,0)); ImageDraw.Draw(glow).rounded_rectangle([*P(262,596),*P(762,624)],radius=14*u,fill=(103,232,249,170))
    from PIL import ImageFilter
    glow=glow.filter(ImageFilter.GaussianBlur(18*u)); im=Image.alpha_composite(glow,im) if False else Image.alpha_composite(im,glow)
    d=ImageDraw.Draw(im)
    # corner brackets
    L,t,m=96,26,262
    for sx,sy in [(-1,-1),(1,-1),(1,1),(-1,1)]:
        ax,ay=512+sx*(m+ (0)),512+sy*(m+30)
        d.line([P(ax,ay),P(ax-sx*L,ay)],fill=(255,255,255,255),width=int(t*u),joint='curve')
        d.line([P(ax,ay),P(ax,ay-sy*L)],fill=(255,255,255,255),width=int(t*u),joint='curve')
        for q in [P(ax,ay),P(ax-sx*L,ay),P(ax,ay-sy*L)]:
            r=t*u/2; d.ellipse([q[0]-r,q[1]-r,q[0]+r,q[1]+r],fill=(255,255,255,255))
    return im.resize((size,size),Image.LANCZOS)
def gradient(size):
    g=Image.new('RGB',(size,size)); px=g.load()
    for y in range(size):
        for x in range(size):
            t=(x+y)/(2*size); px[x,y]=(int(37+(29-37)*t+ (96-37)*(1-t)*0.0),int(99+(78-99)*t),int(235+(180-235)*t))
    return g
def rounded(img,r):
    m=Image.new('L',img.size,0); ImageDraw.Draw(m).rounded_rectangle([0,0,*img.size],radius=int(img.size[0]*r),fill=255)
    o=img.convert('RGBA'); o.putalpha(m); return o
def circle(img):
    m=Image.new('L',img.size,0); ImageDraw.Draw(m).ellipse([0,0,*img.size],fill=255); o=img.convert('RGBA'); o.putalpha(m); return o

bg=gradient(S).convert('RGBA')
full=Image.alpha_composite(bg,doc_layer(S,1.12))        # legacy / store icon
fg=doc_layer(S,0.82)                                     # adaptive foreground (stays inside the 66% safe zone)
os.makedirs('assets',exist_ok=True)
rounded(full,0.22).save('assets/icon.png'); fg.save('assets/icon-foreground.png')
Image.new('RGB',(S,S),(29,78,216)).save('assets/icon-background.png')
for n in (192,512): rounded(full,0.22).resize((n,n),Image.LANCZOS).save(f'www/icon-{n}.png')
dens={'mdpi':(48,108),'hdpi':(72,162),'xhdpi':(96,216),'xxhdpi':(144,324),'xxxhdpi':(192,432)}
for k,(l,a) in dens.items():
    d=f'assets/android/mipmap-{k}'; os.makedirs(d,exist_ok=True)
    rounded(full,0.22).resize((l,l),Image.LANCZOS).save(f'{d}/ic_launcher.png')
    circle(full).resize((l,l),Image.LANCZOS).save(f'{d}/ic_launcher_round.png')
    fg.resize((a,a),Image.LANCZOS).save(f'{d}/ic_launcher_foreground.png')
print('icons done')
