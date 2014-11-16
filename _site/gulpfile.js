var gulp        = require('gulp');
var browserSync = require('browser-sync');
var sass        = require('gulp-ruby-sass');
var prefix      = require('gulp-autoprefixer');
var cp          = require('child_process');
var deploy = require("gulp-gh-pages");
var sourcemaps = require('gulp-sourcemaps');

var messages = {
    jekyllBuild: '<span style="color: grey">Running:</span> $ jekyll build'
};

/**
 * Build the Jekyll Site
 */
gulp.task('jekyll-build', function (done) {
    browserSync.notify(messages.jekyllBuild);
    return cp.spawn('jekyll', ['build'], {stdio: 'inherit'})
        .on('close', done);
});

/**
 * Rebuild Jekyll & do page reload
 */
gulp.task('jekyll-rebuild', ['jekyll-build'], function () {
    browserSync.reload();
});

/**
 * Wait for jekyll-build, then launch the Server
 */
gulp.task('browser-sync', ['sass', 'jekyll-build'], function() {
    browserSync({
        server: {
            baseDir: '_site'
        }
    });
});

/**
 * Compile files from _scss into both _site/css (for live injecting) and site (for future jekyll builds)
 */
gulp.task('sass', function () {
    return gulp.src('_scss/main.scss')
        .pipe(sass({sourcemap: true, sourcemapPath: './'}))
        .on('error', function (err) { console.log(err.message); })
        .pipe(gulp.dest('_site/css'))
        .pipe(browserSync.reload({stream:true}))
        .pipe(gulp.dest('css'));
});

/**
 * Watch scss files for changes & recompile
 * Watch html/md files, run jekyll & reload BrowserSync
 */
gulp.task('watch', function () {
    gulp.watch('_scss/*.scss', ['sass']);
    gulp.watch(['index.html', '_layouts/*.html', '_posts/*', 'styleguide/*.html'], ['jekyll-rebuild']);
});

// Deploy Task
var options = {
    branch: "master"
}

gulp.task("deploy", ["jekyll-build"], function () {
    return gulp.src("./_site/**/*, '!./node_modules/**'")
        .pipe(deploy())
        .pipe(gulp.dest('.tmp'));
});

/**
 * Default task, running just `gulp` will compile the sass,
 * compile the jekyll site, launch BrowserSync & watch files.
 */
gulp.task('default', ['browser-sync', 'watch']);
