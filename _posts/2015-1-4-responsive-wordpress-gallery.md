---
layout: post
title:  "Making a WordPress Gallery Responsive"
date:   2015-1-4
categories: wordpress, rwd, jquery
---

I've been looking for a good responsive WordPress gallery solution as a last step towards finishing this portfolio I've been working on. There are plenty of responsive image solutions for WordPress, but as far as I can tell, they are mostly applicable to single images within a post and less so for a WordPress created gallery. I didn't find a great solution as a plugin, so I decided to build my own. Here's what I've made: 

I installed the [Cleaner Gallery plugin](http://wordpress.org/plugins/cleaner-gallery/) which does a great job of cleaning up the default gallery output by replacing the table elements with figure and div elements. Then I modified the plugin and assigned the Foundation 5 grid classes to the figure elements. This change makes the gallery rows and columns flow in the same manner as the rest of the site. On large screens the gallery has 3 columns, on medium screens there are 2 columns, and on small screens the gallery collapses to 1 column.

I was inspired by this post, [Hassle Free Responsive Images for WordPress](http://css-tricks.com/hassle-free-responsive-images-for-wordpress/) to use the resized images that WordPress generates when you upload an image. I'll serve these resized images to the user based on their screen size. 

This is the part of this challenge that's still a little incomplete. WordPress takes width and height parameters that you specify, resizes the images to fit those parameters and then appends the new parameters to the new filename. For example: "All-My-Sons-2-1000x636.jpg." Unfortunately, I've found ZERO information about how to change this convention. Depending on the initial upload, the dimension sizes vary. In order to serve these images, I needed a consistent naming convention. For the moment, I'm just manually renaming the images, giving the small and medium images a "-small.jpg" or "-medium.jpg" label. Until I either find a plugin or hack at the core, I'll have to keep doing this.

Cleaner Gallery uses the defined thumbnail image size as the thumbnails for the gallery. In my case, these are 400x400. Since these images aren't going to be much bigger or smaller than this, I'm not changing these images for different screens. They'll be a little big for most phones, but not much. 

I want to change the thumbnail attachment link, which is the image that will open in a lightbox when clicked. In the gallery code below, I'm looking to change the link in the anchor tag:

{% highlight html linenos %}
<figure class='gallery-item small-12 medium-6 large-4 columns'>
  <div class='gallery-icon '>
      <a href='http://localhost:8888/wp-content/uploads/2014/03/Suessical-6.jpg' rel="lightbox[gallery-0]">
          <img width="400" height="400" src="http://localhost:8888/wp-content/uploads/2014/03/Suessical-6-400x400.jpg" class="attachment-thumbnail" alt="Suessical- Horton Discovers his flower in Scene 6" />
      </a>
  </div>
</figure>
{% endhighlight %}

I can target this using JQuery. In parts, here is the code I wrote:

{% highlight javascript linenos %}
$(function(){
  var $viewportWidth = $(window).width();
  if ($viewportWidth < 1024 && $viewportWidth > 640 ){
    $('.gallery-icon > a').each(function(){
      this.href = this.href.replace('.jpg', '-medium.jpg');
    });
  } else if ($viewportWidth < 640){
    $('.gallery-icon > a').each(function(){
      this.href = this.href.replace('.jpg', '-small.jpg');
    });
  }
{% endhighlight %}
This first section checks the size of the screen on the first load of the page and changes the link accordingly. Then we get into the resizing magic:

{% highlight javascript linenos %}
  var $vwBeforeResize = $(window).width();
  $(window).resize(function(){
    $vwAfterResize = $(window).width();
    //First check for a large screen
    if ($vwBeforeResize > 1024 && $vwAfterResize > 640){
      $('.gallery-icon > a').each(function(){
        this.href = this.href.replace('.jpg', '-medium.jpg');
      });
    } else if($vwBeforeResize > 1024 && $vwAfterResize < 640){
        $('.gallery-icon > a').each(function(){
        this.href = this.href.replace('.jpg', '-small.jpg');
        });
      }

        //Then check for a medium screen
    if ($vwBeforeResize > 640 && $vwAfterResize > 1024){
      $('.gallery-icon > a').each(function(){
        this.href = this.href.replace('-medium.jpg', '.jpg');
      });
    } else if($vwBeforeResize > 640 && $vwAfterResize < 640){
        $('.gallery-icon > a').each(function(){
        this.href = this.href.replace('-medium.jpg', '-small.jpg');
        });
      }        

    //Then check for a small screen
    if ($vwBeforeResize < 640 && $vwAfterResize > 1024){
      $('.gallery-icon > a').each(function(){
        this.href = this.href.replace('-small.jpg', '.jpg');
      });
    } else if($vwBeforeResize < 640 && $vwAfterResize > 640){
        $('.gallery-icon > a').each(function(){
        this.href = this.href.replace('-small.jpg', '-medium.jpg');
        });
      }
    $vwBeforeResize = $vwAfterResize;
      });
    });
{% endhighlight %}

First we save the screen size in a variable to use in the resize function. Then, after the screen is resized we first check to see if it's now a large size, a medium size, then a small size.  Then we compare the size the screen was before the resize event (the $vwBeforeResize value) to the size it is after the resize event ($vwAfterResize) and replace the end of the attachment link accordingly. Finally we have to assign the $vwAfterResize value to the $vwBeforeResize variable, so that if the screen is resized again, we have the current size. 

Whew. Now, an appropriately sized image will load in the lightbox, based on your screen size. 

I want to automate this further, and if I can find a way to make WordPress automatically append "-medium" and "-small" to the end of the filenames, I'll be very happy. If you know WordPress well and have a solution, I'd love to have it!